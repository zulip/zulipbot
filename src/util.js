/**
 * Sorts and removes duplicate elements from a given array.
 *
 * @param {Array} array Array to remove duplicates from.
 * @return {Array} Sorted array containing only unique entries.
 */

exports.deduplicate = function(array) {
  return Array.from(new Set(array)).sort();
};

/**
 * Retrieves all pages of data from a node-github method.
 * @param {String} path Path of the method in the format "api.method".
 * @param {Object} parameters Parameters to pass to the method.
 * @return {Array} Array of all data entries.
 */

exports.getAllPages = async function(path, parameters) {
  const [api, method] = path.split(".");
  parameters.per_page = 100;

  let response = await this[api][method](parameters);
  let responses = response.data;

  while (this.hasNextPage(response)) {
    response = await this.getNextPage(response);
    responses = responses.concat(response.data);
  }

  return responses;
};

/**
 * Returns a valid promise with a specified value (used for unit testing).
 * @param {String} value Value to return in the promise.
 * @return {Array} Promise containing the specified value.
 */

exports.respond = value => new Promise(resolve => resolve(value));
