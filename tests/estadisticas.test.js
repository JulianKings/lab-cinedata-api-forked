const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const app = require("../src/app.js");
const Pelicula = require("../src/models/Pelicula.js");
const peliculasService = require("../src/services/pelicula.service.js");

const ERROR_MINIMO = {
  error: "Datos no válidos",
  detalles: ["minimo debe ser un entero entre 1 y 50"],
};

let mongod;

function peli(titulo, generos, nota, extra = {}) {
  const datos = { titulo, anio: 2000, generos, director: { nombre: "Dir" }, ...extra };
  if (nota !== undefined) datos.nota = nota;
  return datos;
}

// Fixture:
//  Drama:     9, 9, 8 (no disponible), sin nota -> total 4, media 8.67 (26/3 = 8.6667)
//  Accion:    9, 7                              -> total 2, media 8
//  Comedia:   8, 8                              -> total 2, media 8 (empate con Accion)
//  Terror:    sin nota                          -> total 1, media null
//  Animacion: sin nota                          -> total 1, media null
//  Suspense:  7, 7, 8                           -> total 3, media 7.33 (22/3 = 7.3333)
//  "SinGeneros" (generos: []) no debe aparecer.
// Comedia se inserta antes que Accion para que el orden alfabetico no sea el de insercion.
const FIXTURE = [
  peli("Com1", ["Comedia"], 8),
  peli("Com2", ["Comedia"], 8),
  peli("Terror1", ["Terror"]),
  peli("Anim1", ["Animacion"]),
  peli("DramaAccion", ["Drama", "Accion"], 9),
  peli("Drama2", ["Drama"], 9),
  peli("Drama3", ["Drama"], 8, { disponible: false }),
  peli("Drama4", ["Drama"]),
  peli("Accion2", ["Accion"], 7),
  peli("Susp1", ["Suspense"], 7),
  peli("Susp2", ["Suspense"], 7),
  peli("Susp3", ["Suspense"], 8),
  peli("SinGeneros", [], 10),
];

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // runtimeAdapters: en Jest el import() dinamico de "os" del driver falla y mongod 8 rechaza el handshake
  await mongoose.connect(mongod.getUri(), { runtimeAdapters: { os: require("os") } });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  await Pelicula.deleteMany({});
  await Pelicula.insertMany(FIXTURE);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("GET /peliculas/estadisticas (caso bueno)", () => {
  test("devuelve total y notaMedia por genero, ordenado, sin _id", async () => {
    // Arrange: fixture en beforeEach
    // Act
    const res = await request(app).get("/peliculas/estadisticas");
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { genero: "Drama", total: 4, notaMedia: 8.67 },
      { genero: "Accion", total: 2, notaMedia: 8 },
      { genero: "Comedia", total: 2, notaMedia: 8 },
      { genero: "Suspense", total: 3, notaMedia: 7.33 },
      { genero: "Animacion", total: 1, notaMedia: null },
      { genero: "Terror", total: 1, notaMedia: null },
    ]);
    res.body.forEach((e) => expect(e).not.toHaveProperty("_id"));
  });

  test("una pelicula con varios generos cuenta en cada uno", async () => {
    const res = await request(app).get("/peliculas/estadisticas");
    const accion = res.body.find((e) => e.genero === "Accion");
    const drama = res.body.find((e) => e.genero === "Drama");
    expect(accion.total).toBe(2); // DramaAccion + Accion2
    expect(drama.total).toBe(4);
  });

  test("una pelicula con generos [] no aparece", async () => {
    const res = await request(app).get("/peliculas/estadisticas");
    const sumaTotales = res.body.reduce((s, e) => s + e.total, 0);
    // 12 peliculas con genero, una con 2 generos => 13 pertenencias
    expect(sumaTotales).toBe(13);
    expect(res.body.every((e) => typeof e.genero === "string" && e.genero !== "")).toBe(true);
  });

  test("total cuenta peliculas sin nota y no disponibles; la media ignora las sin nota", async () => {
    const res = await request(app).get("/peliculas/estadisticas");
    const drama = res.body.find((e) => e.genero === "Drama");
    expect(drama.total).toBe(4);
    expect(drama.notaMedia).toBe(8.67);
  });

  test("generos sin ninguna nota tienen notaMedia null y van al final, en orden alfabetico", async () => {
    const res = await request(app).get("/peliculas/estadisticas");
    expect(res.body.slice(-2)).toEqual([
      { genero: "Animacion", total: 1, notaMedia: null },
      { genero: "Terror", total: 1, notaMedia: null },
    ]);
  });

  test("empate en nota se ordena alfabeticamente por genero", async () => {
    const res = await request(app).get("/peliculas/estadisticas");
    const generos = res.body.map((e) => e.genero);
    expect(generos.indexOf("Accion")).toBeLessThan(generos.indexOf("Comedia"));
  });

  test("redondea a 2 decimales", async () => {
    const res = await request(app).get("/peliculas/estadisticas");
    expect(res.body.find((e) => e.genero === "Suspense").notaMedia).toBe(7.33);
    expect(res.body.find((e) => e.genero === "Drama").notaMedia).toBe(8.67);
  });

  test("sin peliculas devuelve 200 con []", async () => {
    await Pelicula.deleteMany({});
    const res = await request(app).get("/peliculas/estadisticas");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /peliculas/estadisticas?minimo (filtro)", () => {
  test("minimo=1 devuelve todos los generos", async () => {
    const res = await request(app).get("/peliculas/estadisticas?minimo=1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
  });

  test("minimo filtra por total (>=)", async () => {
    const res = await request(app).get("/peliculas/estadisticas?minimo=3");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { genero: "Drama", total: 4, notaMedia: 8.67 },
      { genero: "Suspense", total: 3, notaMedia: 7.33 },
    ]);
  });

  test("minimo=4 deja solo el genero con total exactamente 4", async () => {
    const res = await request(app).get("/peliculas/estadisticas?minimo=4");
    expect(res.body.map((e) => e.genero)).toEqual(["Drama"]);
  });

  test("minimo=50 es valido y si nada lo cumple devuelve 200 con []", async () => {
    const res = await request(app).get("/peliculas/estadisticas?minimo=50");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test("?minimo[$gt]=1 se ignora (parser simple) y devuelve 200 con todos", async () => {
    const res = await request(app).get("/peliculas/estadisticas?minimo[$gt]=1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(6);
  });
});

describe("GET /peliculas/estadisticas validacion (400)", () => {
  test.each([
    ["0", "minimo=0"],
    ["51", "minimo=51"],
    ["abc", "minimo=abc"],
    ["1.5", "minimo=1.5"],
    ["vacio", "minimo="],
    ["repetido", "minimo=5&minimo=6"],
  ])("minimo %s devuelve 400 con la forma exacta", async (_nombre, qs) => {
    const res = await request(app).get(`/peliculas/estadisticas?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(ERROR_MINIMO);
  });
});

describe("GET /peliculas/estadisticas error de servidor (500)", () => {
  test("un fallo del servicio devuelve 500 con la forma indicada", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(peliculasService, "estadisticasPorGenero").mockRejectedValue(new Error("boom"));
    const res = await request(app).get("/peliculas/estadisticas");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Error de servidor interno" });
  });

  test("un fallo de la BD en la agregacion devuelve 500", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(Pelicula, "aggregate").mockRejectedValue(new Error("db caida"));
    const res = await request(app).get("/peliculas/estadisticas");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Error de servidor interno" });
  });
});

describe("Regresion de rutas existentes", () => {
  test("/peliculas/estadisticas no pasa por validarId", async () => {
    const res = await request(app).get("/peliculas/estadisticas");
    expect(res.body).not.toEqual({ error: "El id no tiene formato válido" });
    expect(res.status).toBe(200);
  });

  test("/peliculas/top sigue funcionando", async () => {
    const res = await request(app).get("/peliculas/top");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toHaveProperty("titulo");
  });

  test("/peliculas/:id devuelve la pelicula", async () => {
    const p = await Pelicula.findOne({ titulo: "Drama2" });
    const res = await request(app).get(`/peliculas/${p.id}`);
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe("Drama2");
  });

  test("/peliculas/:id con id invalido sigue dando 400 de validarId", async () => {
    const res = await request(app).get("/peliculas/no-es-un-id");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "El id no tiene formato válido" });
  });

  test("/peliculas/:id inexistente da 404", async () => {
    const res = await request(app).get(`/peliculas/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });

  test("GET /peliculas lista con paginacion", async () => {
    const res = await request(app).get("/peliculas");
    expect(res.status).toBe(200);
    expect(res.body.paginacion.total).toBe(FIXTURE.length);
  });

  test("ruta desconocida da 404", async () => {
    const res = await request(app).get("/no-existe");
    expect(res.status).toBe(404);
  });
});

describe("Documentacion OpenAPI", () => {
  test("/api-docs.json incluye /peliculas/estadisticas con el parametro minimo", async () => {
    const res = await request(app).get("/api-docs.json");
    expect(res.status).toBe(200);
    const op = res.body.paths["/peliculas/estadisticas"].get;
    expect(op.parameters[0]).toMatchObject({ name: "minimo", in: "query", required: false });
    expect(op.responses["200"]).toBeDefined();
    expect(op.responses["400"]).toBeDefined();
    expect(res.body.components.schemas.EstadisticaGenero).toBeDefined();
  });

  test("tambien aparecen los endpoints anteriores", async () => {
    const res = await request(app).get("/api-docs.json");
    expect(res.body.paths["/peliculas"].get).toBeDefined();
  });
});

describe("src/server.js y src/app.js", () => {
  // server.js se carga aislado y con config.js/app.js simulados: no toca ninguna BD real.
  function cargarServer({ conectar }) {
    const appFalsa = { listen: jest.fn() };
    jest.resetModules();
    jest.doMock("../src/config/config.js", () => ({ conectar }));
    jest.doMock("../src/app.js", () => appFalsa);
    require("../src/server.js");
    return appFalsa;
  }

  afterEach(() => {
    jest.dontMock("../src/config/config.js");
    jest.dontMock("../src/app.js");
    jest.resetModules();
    delete process.env.PORT;
  });

  test("app.js exporta una app express sin escuchar al requerirlo", () => {
    expect(typeof app).toBe("function");
    expect(typeof app.listen).toBe("function");
  });

  test("server.js conecta y luego escucha en PORT con la app de app.js", async () => {
    process.env.PORT = "4567";
    const conectar = jest.fn().mockResolvedValue();
    const appFalsa = cargarServer({ conectar });
    await new Promise((r) => setTimeout(r, 50));
    expect(conectar).toHaveBeenCalledTimes(1);
    expect(appFalsa.listen).toHaveBeenCalledWith("4567", expect.any(Function));
  });

  test("server.js sale con codigo 1 si falla la conexion", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    const exit = jest.spyOn(process, "exit").mockImplementation(() => {});
    const conectar = jest.fn().mockRejectedValue(new Error("sin conexion"));
    const appFalsa = cargarServer({ conectar });
    await new Promise((r) => setTimeout(r, 50));
    expect(exit).toHaveBeenCalledWith(1);
    expect(appFalsa.listen).not.toHaveBeenCalled();
  });
});
