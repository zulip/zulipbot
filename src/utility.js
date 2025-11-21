/**
 * Sorts and removes duplicate elements from a given array.
 *
 * @param {Array} array Array to remove duplicates from.
 * @return {Array} Sorted array containing only unique entries.
 */

export const deduplicate = function (array) {
  return [...new Set(array)].toSorted();
};

/**
 * Retrieves all pages of data from a node-github method.
 * @param {String} path Path of the method in the format "api.method".
 * @param {Object} parameters Parameters to pass to the method.
 * @return {Array} Array of all data entries.
 */

export const getAllPages = async function (path, parameters) {
  const [api, method] = path.split(".");
  const options = this[api][method].endpoint.merge(parameters);
  const responses = await this.paginate(options);

  return responses;
};
