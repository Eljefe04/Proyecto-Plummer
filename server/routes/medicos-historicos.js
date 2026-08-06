const express = require('express');

const router = express.Router();

// Informacion verificada por busqueda web (Favaloro, Ramon y Cajal, Apgar).
// Maria Luisa Dellamea: pendiente de completar con los datos que aporte el usuario.
const MEDICOS_HISTORICOS = {
  cardiologia: {
    nombre: 'Dr. René Favaloro',
    anios: '1923 - 2000',
    imagen: '/img/historicos/favaloro.jpg',
    bio: 'Cardiocirujano argentino nacido en La Plata. El 9 de mayo de 1967, en la Cleveland Clinic (Ohio, EE.UU.), realizó la primera cirugía de bypass aortocoronario utilizando un injerto de vena safena, técnica que revolucionó el tratamiento de las enfermedades coronarias y salvó millones de vidas en todo el mundo. Nunca patentó su técnica: sostenía que el conocimiento médico debía estar al servicio de todos. Regresó a la Argentina para fundar un centro de excelencia en cardiología y cirugía cardiovascular.',
  },
  neurologia: {
    nombre: 'Santiago Ramón y Cajal',
    anios: '1852 - 1934',
    imagen: '/img/historicos/ramon-y-cajal.jpg',
    bio: 'Médico e histólogo español, considerado el padre de la neurociencia moderna. Mediante la técnica de tinción argéntica, descubrió que el sistema nervioso está formado por células individuales (neuronas) y no por una red continua, sentando las bases de la "doctrina de la neurona". Sus ilustraciones del sistema nervioso siguen usándose para formar generaciones de médicos. En 1906 recibió el Premio Nobel de Fisiología o Medicina, compartido con Camillo Golgi.',
  },
  pediatria: {
    nombre: 'Dra. Virginia Apgar',
    anios: '1909 - 1974',
    imagen: '/img/historicos/apgar.jpg',
    bio: 'Médica estadounidense, anestesióloga y pediatra, fundadora del campo de la neonatología. En 1952 desarrolló y publicó la escala que lleva su nombre, el "Test de Apgar", que evalúa en el primer y quinto minuto de vida la frecuencia cardíaca, el esfuerzo respiratorio, el tono muscular, la respuesta refleja y el color del recién nacido. Este sistema simple redujo drásticamente la mortalidad neonatal y sigue aplicándose hoy en la totalidad de los nacimientos en el mundo.',
  },
  obstetricia: {
    nombre: 'María Luisa Dellamea',
    anios: 'A completar',
    imagen: '/img/historicos/maria-luisa-dellamea.jpg',
    bio: 'Primera obstetra de Quitilipi, Chaco. Biografía a completar con los datos que aportará el usuario.',
  },
};

router.get('/:especialidad', (req, res) => {
  const data = MEDICOS_HISTORICOS[req.params.especialidad];
  if (!data) return res.status(404).json({ error: 'Especialidad no encontrada' });
  res.json(data);
});

module.exports = router;
