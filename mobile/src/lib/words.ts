// Small wording helpers for the store app's screens.

/** "Mike's", "Teters'" (AP style: a name ending in s takes only an apostrophe). */
export function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name}'` : `${name}'s`;
}

/** "1 exercise", "3 exercises". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
