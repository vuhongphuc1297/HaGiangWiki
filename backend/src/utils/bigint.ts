export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function bigintJsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

export function toJsonValue(value: unknown): JsonValue {
  const serialized = JSON.stringify(value, bigintJsonReplacer);
  if (serialized === undefined) throw new Error('Response must be JSON serializable.');
  return JSON.parse(serialized) as JsonValue;
}
