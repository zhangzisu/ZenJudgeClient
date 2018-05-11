function getLanguageModel(language) {
    try {
        let lang = require('./languages/' + language);
        lang.name = language;
        return lang;
    } catch (e) {
        console.log("Do not support " + language);
        return null;
    }
}

module.exports = getLanguageModel;