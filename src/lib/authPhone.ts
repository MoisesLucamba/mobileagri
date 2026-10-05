export function normalizeAngolaAuthPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);

  const national = digits.startsWith('244') ? digits.slice(3) : digits;
  if (!/^9\d{8}$/.test(national)) return null;

  return `+244${national}`;
}