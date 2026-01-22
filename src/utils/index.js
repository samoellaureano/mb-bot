/**
 * src/utils/index.js - Exportação centralizada de utilitários
 */

module.exports = {
    // Config
    config: require('./config'),
    
    // Logger
    Logger: require('./logger'),
    
    // Errors
    ...require('./error-handler'),
    
    // Validators
    Validators: require('./validators'),
    
    // Types
    ...require('./types'),
    
    // Math
    MathUtils: require('./math-utils'),
    
    // Formatters
    Formatters: require('./formatters')
};
