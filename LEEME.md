# Autoescuela 360 — app interna

App web para socios, vendedores e instructores. Se abre desde el celular y se puede agregar a la pantalla de inicio.

| Rol | Qué ve y qué hace |
|---|---|
| **Socio** | Todo: resumen de administración, calendario, ventas, cobros, gastos, pagos a realizar, retiros, equipo y precios |
| **Vendedor** | Carga ventas (con seña y primer encuentro), ve sus ventas y sus comisiones, agenda y mueve clases |
| **Instructor** | Ve solo sus clases, las marca como dadas o con alumno ausente, y ve lo que se le pagó y lo que se le debe |

Los números de la empresa solo los ven los socios. Esto lo controla la base de datos y no la pantalla, así que nadie más puede verlos.

---

## Publicarla (una sola vez, unos 20 minutos)

### 1. Base de datos en Supabase (gratis)
1. Entrá a https://supabase.com y creá un proyecto nuevo, por ejemplo `autoescuela360`. Elegí la región São Paulo.
2. Andá a **SQL Editor → New query**, pegá todo el archivo `supabase/1_esquema.sql` y tocá **Run**.
3. Si querés pasar a la app las ventas y gastos que ya estaban en la planilla: abrí otra query, pegá `supabase/2_datos_planilla.sql` y tocá **Run**. Hacelo **una sola vez**.
4. Andá a **Authentication → Sign In / Providers → Email** y apagá **Confirm email**. Así la gente entra apenas crea su cuenta.
5. Andá a **Project Settings → API** y copiá la **Project URL** y la **anon public key**.

### 2. Configurar la app
Abrí `config.js` y pegá los dos datos del paso anterior:
```js
export const SUPABASE_URL = 'https://xxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';
```

### 3. Subirla a internet (igual que Lista Justa)
1. Creá un repositorio nuevo en GitHub, por ejemplo `autoescuela360-app`, y subí todos estos archivos.
2. En https://vercel.com tocá **Add New → Project**, elegí ese repositorio y tocá **Deploy**. No hace falta tocar ninguna configuración.
3. Vercel te da un link del tipo `autoescuela360-app.vercel.app`.
4. Volvé a Supabase, andá a **Authentication → URL Configuration** y poné ese link en **Site URL**. Esto hace falta para que funcione "Olvidé mi contraseña".

### 4. Primeros pasos
1. **Vos te registrás primero.** El primer usuario queda como **socio** automáticamente.
2. Desde **Equipo → Mandar por WhatsApp**, le pasás el link a Neir, Fala, a los vendedores y a los instructores.
3. Cuando cada uno se registra, le asignás el rol en **Equipo**. Usen el mismo nombre que figura en la planilla (Shirli, Naza…) para que las comisiones se crucen bien con las ventas anteriores.

### Agregarla a la pantalla de inicio
- **iPhone (Safari):** botón Compartir → "Agregar a inicio".
- **Android (Chrome):** menú ⋮ → "Agregar a la pantalla principal" o "Instalar app".

---

## Cómo calcula los números
- **Pago a instructores:** por cada clase marcada como dada o con alumno ausente, $5.000 cada 30 minutos ($10.000 la hora), menos los pagos cargados como gasto "Pago instructor".
- **Comisiones:** $8.000 por venta de un vendedor (los socios no cobran comisión). Se pueden pagar cuando el alumno terminó de pagar el curso. Se descuentan los pagos cargados como gasto "Comisión vendedor".
- **Socios:** resultado acumulado (cobrado − gastos), menos lo que falta pagar a instructores y vendedores, dividido entre los socios, menos lo que retiró cada uno.
- Las tarifas, la comisión, los socios y los precios se cambian desde **Ajustes**.
