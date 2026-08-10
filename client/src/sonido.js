// Beep sintetizado con WebAudio: no requiere archivos de audio.
// Los navegadores bloquean el audio hasta la primera interaccion del
// usuario, cosa que en la practica siempre ocurre (el login).

let contexto = null;

function obtenerContexto() {
  if (!contexto) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    contexto = new AC();
  }
  if (contexto.state === 'suspended') contexto.resume().catch(() => {});
  return contexto;
}

function tono(ctx, frecuencia, inicio, duracion, volumen) {
  const osc = ctx.createOscillator();
  const gan = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = frecuencia;
  gan.gain.setValueAtTime(0, inicio);
  gan.gain.linearRampToValueAtTime(volumen, inicio + 0.012);
  gan.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
  osc.connect(gan);
  gan.connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + duracion + 0.02);
}

/**
 * @param {'normal'|'urgente'} tipo
 */
export function reproducirBeep(tipo = 'normal') {
  try {
    const ctx = obtenerContexto();
    if (!ctx) return;
    const t = ctx.currentTime;

    if (tipo === 'urgente') {
      // Triple pulso mas agudo y marcado para triage 1 y cirugias urgentes.
      tono(ctx, 980, t, 0.14, 0.16);
      tono(ctx, 980, t + 0.19, 0.14, 0.16);
      tono(ctx, 1240, t + 0.38, 0.22, 0.18);
    } else {
      tono(ctx, 660, t, 0.11, 0.11);
      tono(ctx, 880, t + 0.13, 0.16, 0.11);
    }
  } catch {
    // si el navegador bloquea el audio, la notificacion visual igual aparece
  }
}
