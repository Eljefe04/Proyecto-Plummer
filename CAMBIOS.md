# Proyecto Plummer — Paquete de mejoras (acumulativo)

**Este zip reemplaza al anterior.** Contiene todo lo de la entrega 1 más el
trabajo de interfaz. Aplicás uno solo, no dos.

---

## Qué tocar en cada servicio

### Neon — nada

Las migraciones son idempotentes y viven en `server/db/schema.sql`, que ya se
ejecuta en cada arranque. Se aplican solas al redeployar Render.

| Tipo | Qué |
|---|---|
| Tablas nuevas | `sesiones`, `laboratorio_resultados` |
| Columnas nuevas | 16 |
| Restricciones reescritas | `medicos.especialidad`, `cirugias.estado`, estados de laboratorio e imágenes |
| Índices | 7 |

Las restricciones reescritas son lo único que modifica algo existente. Es lo
primero a verificar tras el deploy.

### Render — una variable opcional

`MINUTOS_LIMPIEZA` (por defecto `5`) controla cuánto tarda una cama en pasar de
limpieza a libre. Para una demo, ponela en `1`.

### Netlify — nada

`VITE_API_URL` sigue igual, sin barra final.

### GitHub

```bash
git add .
git commit -m "Mejoras: sesiones persistentes, internacion, tiempo real, interfaz"
git push
```

---

## Lo que entró

### Infraestructura

**Sesiones persistentes.** Vivían en un `Map()` en memoria; cuando Render dormía
o redeployaba se perdían todas y los usuarios quedaban con un token muerto,
recibiendo 401 en cada pedido y pantallas vacías sin explicación. Ahora viven en
la tabla `sesiones` de PostgreSQL. Y si igual vence, el navegador cierra sesión
prolijamente y vuelve al login con un mensaje.

**Tiempo real fluido.** Tres arreglos: WebSocket directo en vez de arrancar con
long-polling (que detrás del proxy de Render a veces nunca subía a WebSocket);
los datos ahora viajan **dentro** del evento, así la pantalla se actualiza sin
disparar un GET completo contra Neon; y las recargas simultáneas se agrupan.

**Notificaciones que llegan.** Se emitía a `rol:${destino}`, pero destinos como
`cardiologia`, `internacion` o `cirugia` no coinciden con los 8 roles de login,
que son las únicas salas que existen: esas notificaciones se emitían al vacío.
Ahora `DESTINO_A_SALAS` mapea cada destino a las salas correctas. Las urgentes
suenan distinto y duran el doble.

**Transacciones** en la capa de base, para los circuitos que tocan varias tablas.

**Arranque en frío.** `/api/ping` y `/api/despertar`, con reintentos y progreso
visible en el login.

### Circuito de internación

`estado = 'internado'` aparecía **solo** en el `WHERE` de la consulta que lista
internados: ninguna ruta lo escribía nunca, así que esa pantalla era
matemáticamente imposible de llenar. Ahora asignar cama marca al paciente
(en transacción), existe `POST /api/enfermeria/alta`, y las camas pasan a
limpieza con marca horaria — **no con `setTimeout`**, que se perdería si Render
se duerme en el medio.

### Interfaz

- **Logo nuevo**: tres fichas sueltas que se apilan en un registro único — los
  cuadernos separados de cada médico convirtiéndose en el expediente unificado.
- **Paleta semántica**: verde resuelto, ámbar pendiente, rojo urgente, azul en
  curso. Mismo significado en las diez pantallas.
- **Login**: electrocardiograma animado en bucle, ficha de Henry Plummer
  explicando el nombre del sistema, y el estado del servidor a la vista con
  barra de progreso.
- **Campana de notificaciones** con contador, historial y sacudida al entrar algo
  nuevo. Antes solo existía el toast de 6 segundos y la notificación se perdía.
- **Celular**: barra lateral convertida en cajón deslizante, navegación inferior,
  tablas que se vuelven tarjetas apiladas, objetivos táctiles de 44 px.
- **Destello** en la fila que se actualiza en vivo.

### Otros

- Botón de eliminar médicos: fallaba por un 403 mudo desde Recepción. Ahora
  Recepción hace alta, edición y baja; el borrado definitivo queda del
  Administrador.
- Cinco fotos procesadas con detección de rostro (512×512, 37–57 KB).
- Ficha completa de María Luisa Dellamea con biografía, epígrafe y 13 hitos.
  Líneas de tiempo y epígrafes también para Favaloro, Ramón y Cajal y Apgar.

---

## Checklist después de desplegar

1. Log de Render: `[db] Conectado a PostgreSQL y esquema verificado.`
2. Entrar. El primer login puede tardar ~50 s, ahora con aviso en pantalla.
3. Esperar 20 minutos sin tocar nada y volver: **antes te expulsaba**.
4. Enfermería → Camas → asignar cama. El paciente aparece en Internación/UTI.
   *Esto antes era imposible.*
5. Dar de alta: sale de la lista, la cama entra en limpieza.
6. Dos pestañas abiertas: un cambio en una aparece casi al instante en la otra.
7. Abrir en el celular: cajón lateral y barra inferior.
8. Las cinco fotos se ven.

---

## Qué falta todavía

Circuitos con el backend listo pero sin pantalla que los use:

- Farmacia: bandeja de recetas y dispensación atada a la receta
- Laboratorio: resultados estructurados con rangos de referencia
- Imágenes: región, motivo, origen y adjuntar la placa
- Quirófano: bandeja de solicitudes, parte quirúrgico, checklist de la OMS
- Anestesiología: bandeja y las dos pantallas que ya existen en la API
- Terminal médica: "Mis pacientes", evoluciones clínicas, ver resultados
- Administrador con acceso de lectura a todos los módulos
