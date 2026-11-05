const express = require("express");
const { listar, top, estadisticas, obtener, resenas, crear, actualizar, eliminar, crearResena } = require("../controller/pelicula.controller.js");
const validarId = require("../middlewares/validarId.js");
const autenticar = require("../middlewares/autenticar.js");
const autorizar = require("../middlewares/autorizar.js");
const validar = require("../middlewares/validar.js");
const { validarEstadisticas } = require("../validators/pelicula.validator.js");

const router = express.Router(); 

/**
 * @openapi
 * /peliculas:
 *   get:
 *     tags: [Películas]
 *     summary: Lista las películas ordenadas por nota
 *     parameters:
 *       - name: genero
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           example: Drama
 *     responses:
 *       200:
 *         description: Lista de películas en resumen
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PeliculasResumen'
 */
router.get("/", listar);

router.get("/top", top);

/**
 * @openapi
 * /peliculas/estadisticas:
 *   get:
 *     tags: [Películas]
 *     summary: Estadísticas de películas por género (total y nota media)
 *     parameters:
 *       - name: minimo
 *         in: query
 *         required: false
 *         description: Número mínimo de películas que debe tener un género para aparecer
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 1
 *           example: 2
 *     responses:
 *       200:
 *         description: Géneros ordenados por nota media descendente (los de nota media nula al final)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/EstadisticaGenero'
 *       400:
 *         description: Parámetro minimo no válido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorValidacion'
 */
router.get("/estadisticas", validarEstadisticas, validar, estadisticas);
router.post("/:id/resenas",autenticar,  validarId, crearResena);
router.get("/:id", validarId, obtener);
router.get("/:id/resenas", validarId, resenas);
// DESPUÉS PROBAREMOS SIN SPREED
router.post("/", autenticar, autorizar("admin"), crear);
router.put("/:id", autenticar, autorizar("admin", "usuario"),validarId, actualizar);
router.delete("/:id", autenticar, autorizar("admin"),validarId, eliminar);

module.exports = router;
