/**
 * Replaces in a given string mustaches with their value from an object
 * @param str String containing mustaches (ex: 'blabla {plop} blabla')
 * @param data Object containing data that will replace mustaches (ex: {plop: 'some other text'})
 */
export function mustache(str: string, data = {}) {
  return Object.entries<string>(data)
    .reduce(
      (res, [key, valueToReplace]) => res.replace(
        new RegExp(`{\s*${key}\s*}`, 'g'),
        valueToReplace
      ),
      str
    );
}
