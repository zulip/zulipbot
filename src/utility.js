/**
 * Sorts and removes duplicate elements from a given array.
 *
 * @param {Array} array Array to remove duplicates from.
 * @return {Array} Sorted array containing only unique entries.
 */

export const deduplicate = function (array) {
  return [...new Set(array)].toSorted();
};
