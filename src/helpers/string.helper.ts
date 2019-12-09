/**
 * Replaces in a given string mustaches with their value from an object
 *
 * @param str String containing mustaches (ex: 'blabla {plop} blabla')
 * @param data Object containing data that will replace mustaches (ex: {plop: 'some other text'})
 * @returns A string where mustaches are replaced by their values
 */
export function mustache(str: string, data = {}): string {
  return Object.entries<string>(data)
    .reduce(
      (res, [key, valueToReplace]) => res.replace(
        new RegExp(`{\s*${key}\s*}`, 'g'),
        valueToReplace
      ),
      str
    );
}
