const express = require('express');

const router = express.Router();

// ------------------------------------------------------------
// Referentes historicos de cada especialidad.
// Favaloro, Ramon y Cajal y Apgar: datos verificados.
// Maria Luisa Dellamea: material aportado por la familia.
// Plummer: da nombre al sistema, se muestra en el login.
// ------------------------------------------------------------
const MEDICOS_HISTORICOS = {
  cardiologia: {
    nombre: 'Dr. René Favaloro',
    titulo: 'Cardiocirujano',
    anios: '1923 - 2000',
    imagen: '/img/historicos/favaloro.jpg',
    bio: 'Cardiocirujano argentino nacido en La Plata. El 9 de mayo de 1967, en la Cleveland Clinic (Ohio, EE.UU.), realizó la primera cirugía de bypass aortocoronario utilizando un injerto de vena safena, técnica que revolucionó el tratamiento de las enfermedades coronarias y salvó millones de vidas en todo el mundo. Nunca patentó su técnica: sostenía que el conocimiento médico debía estar al servicio de todos. Regresó a la Argentina para fundar un centro de excelencia en cardiología y cirugía cardiovascular.',
    epigrafe: 'El conocimiento médico debe estar al servicio de todos.',
    hitos: [
      { fecha: '1923', texto: 'Nace en La Plata, Buenos Aires' },
      { fecha: '1950', texto: 'Se instala como médico rural en Jacinto Aráuz, La Pampa, durante doce años' },
      { fecha: '1967', texto: 'Realiza el primer bypass aortocoronario con vena safena' },
      { fecha: '1971', texto: 'Regresa a la Argentina para desarrollar la cirugía cardiovascular en el país' },
      { fecha: '1975', texto: 'Crea la fundación que lleva su nombre, dedicada a la investigación y la docencia' },
    ],
  },

  neurologia: {
    nombre: 'Santiago Ramón y Cajal',
    titulo: 'Médico e histólogo',
    anios: '1852 - 1934',
    imagen: '/img/historicos/ramon-y-cajal.jpg',
    bio: 'Médico e histólogo español, considerado el padre de la neurociencia moderna. Mediante la técnica de tinción argéntica, descubrió que el sistema nervioso está formado por células individuales (neuronas) y no por una red continua, sentando las bases de la "doctrina de la neurona". Sus ilustraciones del sistema nervioso siguen usándose para formar generaciones de médicos. En 1906 recibió el Premio Nobel de Fisiología o Medicina, compartido con Camillo Golgi.',
    epigrafe: 'Todo hombre puede ser, si se lo propone, escultor de su propio cerebro.',
    hitos: [
      { fecha: '1852', texto: 'Nace en Petilla de Aragón, España' },
      { fecha: '1888', texto: 'Formula la doctrina de la neurona: el sistema nervioso son células individuales' },
      { fecha: '1899', texto: 'Publica su Textura del sistema nervioso del hombre y de los vertebrados' },
      { fecha: '1906', texto: 'Recibe el Premio Nobel de Fisiología o Medicina' },
    ],
  },

  pediatria: {
    nombre: 'Dra. Virginia Apgar',
    titulo: 'Anestesióloga y neonatóloga',
    anios: '1909 - 1974',
    imagen: '/img/historicos/apgar.jpg',
    bio: 'Médica estadounidense, anestesióloga y pediatra, fundadora del campo de la neonatología. En 1952 desarrolló y publicó la escala que lleva su nombre, el "Test de Apgar", que evalúa en el primer y quinto minuto de vida la frecuencia cardíaca, el esfuerzo respiratorio, el tono muscular, la respuesta refleja y el color del recién nacido. Este sistema simple redujo drásticamente la mortalidad neonatal y sigue aplicándose hoy en la totalidad de los nacimientos en el mundo.',
    epigrafe: 'Nadie debería nacer sin que alguien lo esté mirando.',
    hitos: [
      { fecha: '1909', texto: 'Nace en Westfield, Nueva Jersey' },
      { fecha: '1949', texto: 'Primera mujer en alcanzar el rango de profesora titular en Columbia' },
      { fecha: '1952', texto: 'Presenta el test que evalúa la vitalidad del recién nacido en el primer minuto de vida' },
      { fecha: '1959', texto: 'Dedica la última etapa de su carrera a la prevención de defectos congénitos' },
    ],
  },

  obstetricia: {
    nombre: 'María Luisa Dellamea',
    titulo: 'Obstetra',
    anios: '1940 - 2022',
    imagen: '/img/historicos/maria-luisa-dellamea.jpg',
    bio: 'Primera obstetra de Quitilipi, Chaco. Durante toda su vida profesional atendió en su consultorio —que funcionaba en su propia casa, donde también asistía los partos— y en los puestos sanitarios rurales de la zona. Se le atribuye haber acompañado el nacimiento de 40.000 chicos.\n\nLlevó la educación sexual y la prevención de ITS a todas las escuelas de Quitilipi, urbanas y rurales, en una época en que del tema no se hablaba. Tras relevar y presentar una estadística sobre cáncer de cuello uterino en la ciudad, consiguió abrir la primera filial local de LALCEC, que presidió durante diecisiete años y que hoy sigue realizando controles ginecológicos y estudios mamarios sin fines de lucro. También trajo el primer mamógrafo a Quitilipi.\n\nFue la primera mujer rotaria de la ciudad. Quitilipi la nombró Mujer del Año y le puso su nombre a una plazoleta del paseo recreativo en octubre de 2021, dos meses antes de su muerte. En 2025 el Concejo Municipal le dio su nombre a una calle del barrio La Paz.',
    epigrafe: 'Se preocupó y se ocupó por la salud de la mujer durante toda su vida.',
    hitos: [
      { fecha: '8 sep 1940', texto: 'Nace' },
      { fecha: '', texto: 'Primera obstetra de Quitilipi' },
      { fecha: '', texto: 'Instala su consultorio y sala de partos en su propia casa' },
      { fecha: '', texto: 'Atiende en los puestos sanitarios rurales de la zona' },
      { fecha: '', texto: 'Da charlas de educación sexual y prevención de ITS en escuelas urbanas y rurales' },
      { fecha: '', texto: 'Presenta la estadística de cáncer de cuello uterino que da origen a LALCEC Quitilipi' },
      { fecha: '', texto: 'Funda la primera filial de LALCEC en la ciudad y la preside durante 17 años' },
      { fecha: '', texto: 'Trae el primer mamógrafo a Quitilipi' },
      { fecha: '', texto: 'Primera mujer rotaria de Quitilipi' },
      { fecha: '', texto: 'Participa de una brigada infantil de limpieza de la ciudad' },
      { fecha: '30 oct 2021', texto: 'Mujer del Año: plazoleta con su nombre en el paseo recreativo' },
      { fecha: '3 ene 2022', texto: 'Fallece a los 81 años' },
      { fecha: '5 oct 2025', texto: 'Ordenanza municipal 1679/25: calle "María Dellamea", barrio La Paz' },
    ],
  },
};

// ------------------------------------------------------------
// Henry Plummer da nombre al sistema. Se muestra en el login para
// que el nombre del proyecto quede explicado desde la primera pantalla.
// ------------------------------------------------------------
const PLUMMER = {
  nombre: 'Dr. Henry Stanley Plummer',
  titulo: 'Médico internista',
  anios: '1874 - 1936',
  imagen: '/img/historicos/plummer.jpg',
  bio: 'Médico estadounidense de la Mayo Clinic. En 1907 reemplazó los cuadernos que cada médico llevaba por separado por un expediente único por paciente, compartido por todo el hospital y con un número de identificación propio. Esa idea —la historia clínica unificada— es la base de todos los sistemas de gestión hospitalaria modernos, y es la que da nombre a este proyecto.',
  epigrafe: 'Un solo expediente por paciente, compartido por todo el hospital.',
};

router.get('/', (req, res) => {
  res.json({ especialidades: MEDICOS_HISTORICOS, plummer: PLUMMER });
});

router.get('/plummer', (req, res) => res.json(PLUMMER));

router.get('/:especialidad', (req, res) => {
  const data = MEDICOS_HISTORICOS[req.params.especialidad];
  if (!data) return res.status(404).json({ error: 'Especialidad no encontrada' });
  res.json(data);
});

module.exports = router;
