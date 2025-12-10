export const parseDbDate = (label: string, value: unknown) => {
  const asNumber =
    typeof value === "number"
      ? value
      : typeof value === "string" || value instanceof Date
      ? new Date(value).getTime()
      : Number.NaN;

  if (Number.isNaN(asNumber)) {
    throw new Error(`Invalid ${label}`);
  }

  return asNumber;
};
