/** Só os dígitos: "123.456.789-09" → "12345678909". */
export function cpfDigits(v: string) {
  return v.replace(/\D/g, '')
}

/** CPF válido (dígitos verificadores); recusa sequências repetidas como 111.111.111-11. */
export function isCpf(v: string) {
  const d = cpfDigits(v)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

/** 12345678909 → 123.456.789-09 (enquanto digita, formata o que tiver). */
export function formatCpf(v: string) {
  const d = cpfDigits(v).slice(0, 11)
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2')
}
