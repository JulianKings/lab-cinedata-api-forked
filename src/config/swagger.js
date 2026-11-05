   const path = require('node:path');
const swaggerJsdoc = require("swagger-jsdoc");

const opciones = {
    definition: {
        openapi: "3.0.3",
        info: {
            title: "CineData API",
            version: "1.0.0",
            description: "API de CineData"
        },
        servers: [{ url: "http://localhost:3000" }],
        tags: [
            { name: "Películas", description: "Catalogo de peliculas" },
            { name: "Usuarios", description: "Usuarios que esriben reseñas" }
        ],
        components: {
            parameters: {
                Id: {
                    name: "id",
                    in: "path",
                    required: true,
                    description: "ObjectId de MongoDB (24 caracteres hexadecimales)",
                    schema: { type: "string", example: "6adb........" }
                }
            },
            schemas: {
                PeliculasResumen: {
                    type: "object",
                    properties: {
                        id: { type: "string", example: "6adb...." },
                        titulo: { type: "string", example: "Coco" },
                        anio: { type: "integer", example: 2017 },
                        nota: { type: "number", example: 8.6 }
                    }
                },
                Pelicula: {
                    type: "object",
                    properties: {
                        id: { type: "string", example: "6adb...." },
                        titulo: { type: "string", example: "Coco" },
                        anio: { type: "integer", example: 2017 },
                        nota: { type: "number", example: 8.6 },
                        generos: { type: "array", items: { type: "string" }, example: ["Drama"] },
                        director: { type: "string", example: "Nolan" },
                        duracion: { type: "string", example: "2h 40 min" },
                        disponible: { type: "boolean", example: true }
                    }
                },
                EstadisticaGenero: {
                    type: "object",
                    properties: {
                        genero: { type: "string", example: "Drama" },
                        total: { type: "integer", example: 4 },
                        notaMedia: { type: "number", nullable: true, example: 8.48 }
                    }
                },
                Error: {
                    type: "object",
                    properties: {
                        error: { type: "string", example: "Pelicula no encontrada" }
                    }
                },
                ErrorValidacion: {
                    type: "object",
                    properties: {
                        error: { type: "string", example: "Datos no válidos" },
                        detalles: { type: "array", items: { type: "string" }, example: ["Titulo obligatorio", "Nota maxima 5"] }
                    }
                }

            }
        }
    },
       // swagger-jsdoc usa glob, que exige "/" (en Windows path.join genera "\")
       apis: [path.join(__dirname, '../routes/*.js').split(path.sep).join('/')]
};

module.exports = swaggerJsdoc(opciones);       