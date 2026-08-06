const { v4: uuidv4 } = require('uuid');

function nuevoId() {
  return uuidv4();
}

function parseJsonSafe(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const ESPECIALIDAD_A_SALA = {
  obstetricia: 'medico', // se usa junto con medicoId puntual
  cardiologia: 'medico',
  neurologia: 'medico',
  pediatria: 'medico',
};

const AREAS_DERIVACION = [
  { valor: 'obstetricia', label: 'Obstetricia' },
  { valor: 'cardiologia', label: 'Cardiologia' },
  { valor: 'neurologia', label: 'Neurologia' },
  { valor: 'pediatria', label: 'Pediatria' },
  { valor: 'guardia', label: 'Guardia / Urgencias' },
  { valor: 'laboratorio', label: 'Laboratorio' },
  { valor: 'imagenes', label: 'Radiografia / Imagenes' },
  { valor: 'terapia_intensiva', label: 'Terapia Intensiva' },
  { valor: 'internacion', label: 'Internacion' },
  { valor: 'cirugia', label: 'Cirugia' },
  { valor: 'anestesiologia', label: 'Anestesiologia' },
  { valor: 'farmacia', label: 'Farmacia' },
];

module.exports = { nuevoId, parseJsonSafe, ESPECIALIDAD_A_SALA, AREAS_DERIVACION };
