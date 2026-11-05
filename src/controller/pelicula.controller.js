const { matchedData } = require("express-validator");
const peliculasService =require("../services/pelicula.service.js");
const resenasService = require("../services/resena.service.js");

const ORDENES = {
    nota: {nota: -1, titulo: 1},
    anio: {anio: -1, titulo: 1},
    titulo: {titulo: 1}
};

async function listar(req, res) {
    const {genero, anioDesde, notaMin, disponible, orden = "nota"} = req.query;
    const pagina = Math.max(parseInt(req.query.page) || 1, 1) ;
    const limite = Math.min(Math.max(parseInt(req.query.limit) || 10, 1 ), 50);

    if (!ORDENES[orden]) {
        return res.status(400).json({error: ` Orden no valido. Usa: ${Object.keys(ORDENES).join(', ')}` });
    }

    const filtros = {genero, anioDesde, notaMin, disponible}; 
    const {peliculas, total} =  await peliculasService.listar(filtros, ORDENES[orden], pagina, limite);

    res.json({
        datos: peliculas.map(p => p.resumen()),
        paginacion: {
            pagina,
            limite, 
            total,
            paginas: Math.ceil(total / limite)
        }
    });
}

async function top(req, res) {
    const peliculas = await peliculasService.mejores(3);
    res.json(peliculas.map(p => p.resumen()));
}

async function estadisticas(req, res) {
    const { minimo = 1 } = matchedData(req);
    res.json(await peliculasService.estadisticasPorGenero(minimo));
}

async function obtener(req, res) {
    const pelicula = await peliculasService.buscarPorId(req.params.id);
    if (!pelicula) {
        return res.status(404).json({ error: "Película no encontrada" });
    }
    res.json(pelicula);
}

// POST/ peliculas
async function crear(req, res) {
    const pelicula = await peliculasService.crear(req.body);
    res.status(201).json(pelicula);
} 

// PUT /peliculas/:id

async function actualizar(req, res) {
    const pelicula = await peliculasService.actualizar(req.params.id, req.body);
    if (!pelicula) {
        return res.status(404).json({error: "PElicula not found"});
    }
    res.json(pelicula);
}

// DELETE peliculas/:id

async function eliminar(req, res) {
    const pelicula = await peliculasService.eliminar(req.params.id);
    if (!pelicula) {
        return res.status(404).json({error: "PElicula not found"});
    }
    res.status(204).end();
}


async function resenas(req, res) {
    const lista = await resenasService.dePelicula(req.params.id);
    res.json(lista);
}

async function crearResena(req, res){
    const pelicula = await peliculasService.buscarPorId(req.params.id);
    if(!pelicula) {
        return res.status(404).json({error: "Pelicula no encontrada"});
    }
    const resena = await resenasService.crear(req.params.id, req.usuario.id, req.body);
    res.status(201).json(resena);

}

module.exports = { listar, top, estadisticas, obtener, resenas, crear, actualizar, eliminar, crearResena };
