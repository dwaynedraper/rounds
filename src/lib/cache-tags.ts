/* The complete cache-tag vocabulary (plan §3). Every public read is cached
 * under exactly one of these; every mutation revalidates exactly the tags it
 * dirties. There is no fourth tag — new data joins one of these. */
export const CATALOG = "catalog"; // brands, products, fixtures, sections, positions, flags
export const storeTag = (n: string) => `store:${n}`; // a store's overrides + living conditions
export const roundsTag = (n: string) => `rounds:${n}`; // a store's round history
