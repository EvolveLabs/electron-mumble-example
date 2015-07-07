
function StorageService() {
    this.store = typeof(Storage) !== 'undefined' ? localStorage : {}
}

function get(key) {
    return this.store.getItem(key)
}

function set(key, value) {
    this.store.setItem(key, value)
    return value
}


StorageService.prototype.get = get
StorageService.prototype.set = set
module.exports = StorageService