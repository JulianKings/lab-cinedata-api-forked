const { query } = require("express-validator");

const MSG = "minimo debe ser un entero entre 1 y 50";

const validarEstadisticas = [
    query("minimo")
        .optional()
        .not().isArray().withMessage(MSG).bail()
        .isInt({ min: 1, max: 50 }).withMessage(MSG)
        .toInt()
];

module.exports = { validarEstadisticas };
