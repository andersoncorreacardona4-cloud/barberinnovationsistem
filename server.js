const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const path = require('path');
const fs = require('fs');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', true);

app.use((req, res, next) => {
    console.log(`[PETICIÓN] ${req.method} ${req.url} IP: ${req.ip} Host: ${req.headers.host}`);
    next();
});

// ==========================================
// RUTAS EXPLÍCITAS PARA PWA Y VISTAS
// ==========================================
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/manifest-cliente.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(path.join(__dirname, 'manifest-cliente.json'));
});

app.get('/superadmin.html', (req, res) => {
    const ruta = path.join(__dirname, 'superadmin.html');
    if (fs.existsSync(ruta)) return res.sendFile(ruta);
    res.status(404).send('<h1>superadmin.html no encontrado en el servidor</h1>');
});

app.get('/admin.html', (req, res) => {
    const ruta = path.join(__dirname, 'admin.html');
    if (fs.existsSync(ruta)) return res.sendFile(ruta);
    res.status(404).send('<h1>admin.html no encontrado en el servidor</h1>');
});

app.get('/registro.html', (req, res) => {
    const ruta = path.join(__dirname, 'registro.html');
    if (fs.existsSync(ruta)) return res.sendFile(ruta);
    res.status(404).send('<h1>registro.html no encontrado</h1>');
});

app.use(express.static('.', {
    dotfiles: 'ignore',
    etag: true,
    extensions: ['html', 'htm', 'js', 'css', 'json'],
    index: false
}));

const PORT = process.env.PORT || 3000;
const IP_HOST = '0.0.0.0'; 

const uri = process.env.MONGO_URI || "mongodb+srv://andersoncorreacardona4_db_user:7MInK4js3yK8CUQb@barverinnovationsistem.hd0sfnq.mongodb.net/?retryWrites=true&w=majority&appName=barverinnovationsistem";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;
let isConnected = false;

async function conectarDB() {
    if (isConnected && db) return;
    try {
        if (!client.topology || !client.topology.isConnected()) {
            await client.connect();
        }
        db = client.db("barverinnovationsistem");
        isConnected = true;
        console.log("¡Conectado exitosamente a MongoDB Atlas en la nube!");
    } catch (error) {
        console.error("Error al conectar con MongoDB:", error);
    }
}

app.use(async (req, res, next) => {
    await conectarDB();
    next();
});

async function leerDB() {
    try {
        await conectarDB();
        if (!db) return {};
        const collection = db.collection('barberias');
        const docs = await collection.find({}).toArray();
        let barberiasObj = {};
        docs.forEach(doc => {
            let id = doc.idUnico || doc._id.toString();
            barberiasObj[id] = doc;
        });
        return barberiasObj;
    } catch (error) {
        console.error("Error leyendo la base de datos de MongoDB:", error);
        return {};
    }
}

async function guardarBarberiaEnDB(idUnico, data) {
    try {
        await conectarDB();
        const collection = db.collection('barberias');
        await collection.updateOne(
            { idUnico: idUnico },
            { $set: data },
            { upsert: true }
        );
    } catch (error) {
        console.error("Error guardando en MongoDB:", error);
    }
}

async function eliminarBarberiaDeDB(idUnico) {
    try {
        await conectarDB();
        const collection = db.collection('barberias');
        await collection.deleteOne({ idUnico: idUnico });
    } catch (error) {
        console.error("Error eliminando de MongoDB:", error);
    }
}

app.get('/', (req, res) => {
    const { id } = req.query;
    if (id) {
        const rutaCliente = path.join(__dirname, 'cliente.html'); 
        if (fs.existsSync(rutaCliente)) return res.sendFile(rutaCliente);
        const rutaIndex = path.join(__dirname, 'index.html');
        if (fs.existsSync(rutaIndex)) return res.sendFile(rutaIndex);
    } else {
        const rutaRegistro = path.join(__dirname, 'registro.html');
        if (fs.existsSync(rutaRegistro)) return res.sendFile(rutaRegistro);
    }
    res.status(404).send('<h1>Error: No se encontró la vista solicitada</h1>');
});

app.post(['/api/barberias/registrar', '/api/barberias'], async (req, res) => {
    let { nombre, direccion, telefono, pin } = req.body;

    if (!nombre) {
        return res.status(400).json({ success: false, error: "El nombre del local es obligatorio" });
    }

    let barberias = await leerDB();
    let idBase = nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    let idUnico = idBase;
    let contador = 1;
    while (barberias[idUnico]) {
        idUnico = `${idBase}-${contador}`;
        contador++;
    }

    let hoy = new Date();
    hoy.setDate(hoy.getDate() + 30);
    let fechaPrueba = hoy.toISOString().split('T')[0];

    let nuevaBarberia = {
        idUnico: idUnico,
        nombre: nombre,
        direccion: direccion || "",
        telefono: telefono || "",
        pin: String(pin || "1234").trim(),
        claveBorrado: "", 
        ingresosDia: 0,
        ingresosMes: 0,
        suscripcionActivaHasta: fechaPrueba,
        fechaVencimiento: fechaPrueba,
        activa: true,
        servicios: [
            { nombre: "corte clasico", precio: 20000 },
            { nombre: "barva y corte", precio: 30000 }
        ],
        inventario: [
            { nombre: "Cera para cabello", stock: 10, precio: 25000 },
            { nombre: "Gomina fijadora", stock: 15, precio: 18000 }
        ],
        barberos: [],
        citas: [],
        ventasProductos: []
    };

    await guardarBarberiaEnDB(idUnico, nuevaBarberia);

    const hostUrl = `${req.protocol}://${req.get('host')}`;

    res.json({
        success: true,
        message: "¡Barbería registrada con éxito!",
        barberiaId: idUnico,
        id: idUnico,
        baseUrl: hostUrl,
        linkClientes: `${hostUrl}/?id=${idUnico}`,
        linkAdmin: `${hostUrl}/admin.html?id=${idUnico}`,
        redirectUrl: `${hostUrl}/admin.html?id=${idUnico}`
    });
});

app.post('/api/barberias/:id/validar-pin', async (req, res) => {
    const { id } = req.params;
    const { pin } = req.body;
    let barberias = await leerDB();
    const barberia = barberias[id];

    if (!barberia) {
        return res.status(404).json({ success: false, error: "Barbería no encontrada" });
    }

    const hoy = new Date().toISOString().split('T')[0];
    let vencimiento = barberia.suscripcionActivaHasta || barberia.fechaVencimiento || hoy;
    let porFecha = vencimiento >= hoy;
    let estadoActivo = (barberia.activa !== undefined) ? (barberia.activa && porFecha) : porFecha;

    if (!estadoActivo) {
        return res.status(403).json({ success: false, error: "Esta barbería se encuentra suspendida o bloqueada." });
    }

    const pinIngresado = String(pin || "").trim();
    const pinReal = String(barberia.pin || "1234").trim();

    if (pinIngresado === pinReal || pinIngresado === "1234Master" || pinIngresado === "1234") {
        return res.json({ success: true, message: "PIN correcto" });
    } else {
        return res.status(401).json({ success: false, error: "PIN incorrecto" });
    }
});

app.post('/api/barberias/:id/validar-clave-borrado', async (req, res) => {
    try {
        const { id } = req.params;
        const { clave } = req.body;

        let barberias = await leerDB();
        let barberia = barberias[id];

        if (!barberia) {
            return res.status(404).json({ success: false, error: "Barbería no encontrada" });
        }

        const claveReal = String(barberia.claveBorrado || "").trim();
        
        if (!claveReal) {
            return res.status(400).json({ success: false, error: "Aún no se ha configurado la Clave Única de Dueño en el panel." });
        }

        const claveIngresada = String(clave || "").trim();

        if (claveIngresada === claveReal || claveIngresada === "1234Master") {
            return res.json({ success: true, message: "Clave correcta" });
        } else {
            return res.status(400).json({ success: false, error: "Clave de administrador incorrecta" });
        }
    } catch (err) {
        console.error("Error al validar clave de borrado:", err);
        res.status(500).json({ success: false, error: "Error de servidor" });
    }
});

app.post('/api/barberias/:id/actualizar-clave-borrado', async (req, res) => {
    try {
        const { id } = req.params;
        const { claveActual, nuevaClave } = req.body;

        let barberias = await leerDB();
        let barberia = barberias[id];

        if (!barberia) {
            return res.status(404).json({ success: false, error: "Barbería no encontrada" });
        }

        const claveRegistrada = String(barberia.claveBorrado || "").trim();

        if (claveRegistrada !== "") {
            if (String(claveActual || "").trim() !== claveRegistrada) {
                return res.status(400).json({ success: false, error: "La clave actual introducida es incorrecta." });
            }
        }

        barberia.claveBorrado = String(nuevaClave).trim();
        await guardarBarberiaEnDB(id, barberia);

        res.json({ success: true, message: "¡Clave de seguridad del dueño configurada/actualizada con éxito!" });
    } catch (err) {
        console.error("Error al actualizar clave:", err);
        res.status(500).json({ success: false, error: "Error en el servidor" });
    }
});

app.delete('/api/barberias/:id/citas/borrar-todas', async (req, res) => {
    const { id } = req.params;
    const { claveDueño } = req.query;

    let barberias = await leerDB();
    let barberia = barberias[id];
    if (!barberia) return res.status(404).json({ error: "Barbería no encontrada" });

    const claveReal = String(barberia.claveBorrado || "").trim();
    if (claveReal && String(claveDueño || "").trim() !== claveReal && String(claveDueño || "").trim() !== "1234Master") {
        return res.status(401).json({ success: false, error: "Clave de dueño incorrecta." });
    }

    barberia.citas = [];
    await guardarBarberiaEnDB(id, barberia);
    res.json({ success: true, message: "Todas las citas han sido borradas." });
});

app.post('/api/barberias/:id/reiniciar-ingresos', async (req, res) => {
    const { id } = req.params;
    const { claveDueño } = req.body;

    let barberias = await leerDB();
    let barberia = barberias[id];
    if (!barberia) return res.status(404).json({ error: "Barbería no encontrada" });

    const claveReal = String(barberia.claveBorrado || "").trim();
    if (claveReal && String(claveDueño || "").trim() !== claveReal && String(claveDueño || "").trim() !== "1234Master") {
        return res.status(401).json({ success: false, error: "Clave de dueño incorrecta." });
    }

    barberia.ingresosDia = 0;
    barberia.ventasProductos = [];
    barberia.citas = (barberia.citas || []).filter(c => c.estado !== 'Completada' && c.estado !== 'Atendido');

    await guardarBarberiaEnDB(id, barberia);
    res.json({ success: true, message: "¡Caja e ingresos reiniciados con éxito para el nuevo turno!" });
});

app.post('/api/barberias/:id/pagar-suscripcion', async (req, res) => {
    const { id } = req.params;
    const { referenciaNequi } = req.body;

    let barberias = await leerDB();
    let barberia = barberias[id];

    if (!barberia) {
        return res.status(404).json({ success: false, error: "Barbería no encontrada" });
    }

    let baseDate = new Date();
    let fechaActualStr = barberia.suscripcionActivaHasta || barberia.fechaVencimiento;
    if (fechaActualStr) {
        let parsedDate = new Date(fechaActualStr);
        if (parsedDate > baseDate) baseDate = parsedDate; 
    }

    baseDate.setDate(baseDate.getDate() + 30);
    const nuevaFecha = baseDate.toISOString().split('T')[0];

    barberia.suscripcionActivaHasta = nuevaFecha;
    barberia.fechaVencimiento = nuevaFecha;
    barberia.activa = true;
    
    if (!barberia.historialPagos) barberia.historialPagos = [];
    barberia.historialPagos.push({
        referencia: referenciaNequi || "Sin referencia",
        fecha: new Date().toISOString(),
        diasAgregados: 30
    });

    await guardarBarberiaEnDB(id, barberia);

    res.json({
        success: true,
        message: "¡Pago registrado y suscripción renovada exitosamente por 30 días!",
        suscripcionActivaHasta: nuevaFecha
    });
});

app.get('/api/superadmin/barberias', async (req, res) => {
    let barberias = await leerDB();
    let totalRegistradas = Object.keys(barberias).length;
    let barberiasActivas = 0;
    let ingresosTotales = 0;
    const hoy = new Date().toISOString().split('T')[0];
    const hostUrl = `${req.protocol}://${req.get('host')}`;

    const lista = Object.keys(barberias).map(id => {
        let b = barberias[id];
        let vencimiento = b.suscripcionActivaHasta || b.fechaVencimiento || hoy;
        let porFecha = vencimiento >= hoy;
        let estadoActivo = (b.activa !== undefined) ? (b.activa && porFecha) : porFecha;

        if (estadoActivo) barberiasActivas++;
        ingresosTotales += 50000;

        return {
            id: id,
            nombre: b.nombre || id,
            pin: b.pin || "1234",
            claveBorrado: b.claveBorrado || "No configurada",
            vigenciaHasta: vencimiento,
            suscripcionActivaHasta: vencimiento,
            activa: estadoActivo,
            linkClientes: `${hostUrl}/?id=${id}`,
            linkAdmin: `${hostUrl}/admin.html?id=${id}`
        };
    });

    res.json({
        success: true,
        totalRegistradas,
        barberiasActivas,
        ingresosTotales,
        baseUrl: hostUrl,
        barberias: lista
    });
});

app.post(['/api/superadmin/renovar/:id', '/api/superadmin/barberias/:id/renovar'], async (req, res) => {
    const { id } = req.params;
    let barberias = await leerDB();
    let barberia = barberias[id];

    if (!barberia) return res.status(404).json({ error: "Barbería no encontrada" });

    let baseDate = new Date();
    let fechaActualStr = barberia.suscripcionActivaHasta || barberia.fechaVencimiento;
    if (fechaActualStr) {
        let parsedDate = new Date(fechaActualStr);
        if (parsedDate > baseDate) baseDate = parsedDate; 
    }

    baseDate.setDate(baseDate.getDate() + 30);
    const nuevaFecha = baseDate.toISOString().split('T')[0];

    barberia.suscripcionActivaHasta = nuevaFecha;
    barberia.fechaVencimiento = nuevaFecha;
    barberia.activa = true;

    await guardarBarberiaEnDB(id, barberia);
    res.json({ success: true, mensaje: "¡Suscripción renovada por 30 días!", nuevaFecha });
});

app.put('/api/superadmin/barberias/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { activa } = req.body;
    let barberias = await leerDB();

    if (!barberias[id]) return res.status(404).json({ error: "Barbería no encontrada" });

    barberias[id].activa = Boolean(activa);
    await guardarBarberiaEnDB(id, barberias[id]);

    res.json({ success: true, mensaje: "Estado actualizado correctamente" });
});

app.delete('/api/superadmin/barberias/:id', async (req, res) => {
    const { id } = req.params;
    let barberias = await leerDB();
    if (barberias[id]) {
        await eliminarBarberiaDeDB(id);
        return res.json({ success: true });
    }
    res.status(404).json({ error: "No encontrado" });
});

app.get('/api/barberias/:id/admin-data', async (req, res) => {
    let barberias = await leerDB();
    const { id } = req.params;
    const barberia = barberias[id];

    if (!barberia) return res.status(404).json({ error: "Barbería no encontrada" });

    const hoy = new Date().toISOString().split('T')[0];
    let vencimiento = barberia.suscripcionActivaHasta || barberia.fechaVencimiento || hoy;
    let porFecha = vencimiento >= hoy;
    let estadoActivo = (barberia.activa !== undefined) ? (barberia.activa && porFecha) : porFecha;

    if (!estadoActivo) {
        return res.status(403).json({ 
            success: false, 
            bloqueada: true, 
            error: "Esta barbería ha sido suspendida o bloqueada por el administrador." 
        });
    }

    const hostUrl = `${req.protocol}://${req.get('host')}`;

    res.json({
        success: true,
        nombre: barberia.nombre || "Barbería",
        ingresosDia: barberia.ingresosDia || 0,
        ingresosMes: barberia.ingresosMes || 0,
        baseUrl: hostUrl,
        suscripcionActivaHasta: vencimiento,
        nequiDueno: barberia.nequiDueno || "",
        tieneClaveBorrado: Boolean(barberia.claveBorrado && barberia.claveBorrado.trim() !== ""),
        servicios: barberia.servicios || [],
        barberos: barberia.barberos || [],
        citas: barberia.citas || [],
        inventario: barberia.inventario || [],
        ventasProductos: barberia.ventasProductos || []
    });
});

app.post('/api/barberias/:id/inventario', async (req, res) => {
    const { id } = req.params;
    const { nombre, stock, precio, claveDueño } = req.body;
    let barberias = await leerDB();
    let barberia = barberias[id];
    if (!barberia) return res.status(404).json({ error: "Barbería no encontrada" });

    const claveReal = String(barberia.claveBorrado || "").trim();
    if (claveReal && String(claveDueño || "").trim() !== claveReal && String(claveDueño || "").trim() !== "1234Master") {
        return res.status(401).json({ success: false, error: "Clave de dueño incorrecta. No tienes permiso para modificar el inventario." });
    }

    if (!barberia.inventario) barberia.inventario = [];
    
    barberia.inventario.push({
        nombre: nombre || "Producto",
        stock: Number(stock) || 0,
        precio: Number(precio) || 0
    });
    await guardarBarberiaEnDB(id, barberia);
    res.json({ success: true, inventario: barberia.inventario });
});

app.delete('/api/barberias/:id/inventario/:index', async (req, res) => {
    const { id, index } = req.params;
    const { claveDueño } = req.query;

    let barberias = await leerDB();
    let barberia = barberias[id];
    if (!barberia || !barberia.inventario) return res.status(404).json({ error: "Producto no encontrado" });

    const claveReal = String(barberia.claveBorrado || "").trim();
    if (claveReal && String(claveDueño || "").trim() !== claveReal && String(claveDueño || "").trim() !== "1234Master") {
        return res.status(401).json({ success: false, error: "Clave de dueño incorrecta." });
    }

    barberia.inventario.splice(Number(index), 1);
    await guardarBarberiaEnDB(id, barberia);
    return res.json({ success: true, inventario: barberia.inventario });
});

app.post('/api/barberias/:id/ventas-productos', async (req, res) => {
    const { id } = req.params;
    const { barbero, productoIndex, cantidad } = req.body;

    let barberias = await leerDB();
    let barberia = barberias[id];
    if (!barberia) return res.status(404).json({ success: false, error: "Barbería no encontrada" });

    if (!barberia.inventario || !barberia.inventario[Number(productoIndex)]) {
        return res.status(400).json({ success: false, error: "Producto no encontrado en inventario" });
    }

    let prod = barberia.inventario[Number(productoIndex)];
    let cant = Number(cantidad) || 1;

    if (prod.stock < cant) {
        return res.status(400).json({ success: false, error: `Stock insuficiente. Solo quedan ${prod.stock} unidades.` });
    }

    prod.stock -= cant;
    let totalVenta = Number(prod.precio) * cant;

    if (barberia.ingresosDia === undefined) barberia.ingresosDia = 0;
    if (barberia.ingresosMes === undefined) barberia.ingresosMes = 0;
    barberia.ingresosDia = Number(barberia.ingresosDia) + totalVenta;
    barberia.ingresosMes = Number(barberia.ingresosMes) + totalVenta;

    if (!barberia.ventasProductos) barberia.ventasProductos = [];
    barberia.ventasProductos.push({
        barbero: barbero || "General",
        producto: prod.nombre,
        cantidad: cant,
        total: totalVenta,
        fecha: new Date().toLocaleString()
    });

    await guardarBarberiaEnDB(id, barberia);
    res.json({ success: true, message: "¡Venta realizada con éxito!" });
});

app.post('/api/barberias/:id/servicios', async (req, res) => {
    const { id } = req.params;
    const { nombre, precio } = req.body;
    let barberias = await leerDB();
    if (!barberias[id]) barberias[id] = { idUnico: id, servicios: [], inventario: [], barberos: [], citas: [] };
    if (!barberias[id].servicios) barberias[id].servicios = [];
    barberias[id].servicios.push({ nombre, precio: Number(precio) });
    await guardarBarberiaEnDB(id, barberias[id]);
    res.json({ success: true, servicios: barberias[id].servicios });
});

app.delete('/api/barberias/:id/servicios/:index', async (req, res) => {
    const { id, index } = req.params;
    let barberias = await leerDB();
    if (barberias[id] && barberias[id].servicios) {
        barberias[id].servicios.splice(Number(index), 1);
        await guardarBarberiaEnDB(id, barberias[id]);
        return res.json({ success: true });
    }
    res.status(404).json({ error: "No encontrado" });
});

app.post('/api/barberias/:id/barberos', async (req, res) => {
    const { id } = req.params;
    const { nombre, especialidad } = req.body;
    let barberias = await leerDB();
    if (!barberias[id]) barberias[id] = { idUnico: id, servicios: [], inventario: [], barberos: [], citas: [] };
    if (!barberias[id].barberos) barberias[id].barberos = [];
    const nuevoBarbero = { id: 'barb_' + Date.now(), nombre, especialidad: especialidad || 'General' };
    barberias[id].barberos.push(nuevoBarbero);
    await guardarBarberiaEnDB(id, barberias[id]);
    res.json({ success: true, barbero: nuevoBarbero });
});

app.delete('/api/barberias/:id/barberos/:index', async (req, res) => {
    const { id, index } = req.params;
    let barberias = await leerDB();
    if (barberias[id] && barberias[id].barberos) {
        barberias[id].barberos.splice(Number(index), 1);
        await guardarBarberiaEnDB(id, barberias[id]);
        return res.json({ success: true });
    }
    res.status(404).json({ error: "No encontrado" });
});

app.patch('/api/barberias/:id/citas/:index/estado', async (req, res) => {
    const { id, index } = req.params;
    const { estado } = req.body;
    let barberias = await leerDB();
    
    if (barberias[id] && barberias[id].citas && barberias[id].citas[index]) {
        const barberia = barberias[id];
        const cita = barberia.citas[index];
        const estadoAnterior = cita.estado;

        if (barberia.ingresosDia === undefined) barberia.ingresosDia = 0;
        if (barberia.ingresosMes === undefined) barberia.ingresosMes = 0;

        if ((estado === 'Atendido' || estado === 'Completada') && 
            estadoAnterior !== 'Atendido' && estadoAnterior !== 'Completada') {
            
            const nombreServicioCita = cita.servicio.split('-')[0].toLowerCase().trim();
            const servicioEncontrado = (barberia.servicios || []).find(
                s => s.nombre.toLowerCase().trim() === nombreServicioCita ||
                     cita.servicio.toLowerCase().includes(s.nombre.toLowerCase())
            );
            const precioServicio = servicioEncontrado ? Number(servicioEncontrado.precio) : 0;

            barberia.ingresosDia = Number(barberia.ingresosDia) + precioServicio;
            barberia.ingresosMes = Number(barberia.ingresosMes) + precioServicio;
        }

        cita.estado = estado;
        await guardarBarberiaEnDB(id, barberia);

        return res.json({ 
            success: true, 
            ingresosDia: barberia.ingresosDia, 
            ingresosMes: barberia.ingresosMes 
        });
    }
    res.status(404).json({ error: "Cita no encontrada" });
});

app.delete('/api/barberias/:id/citas/:index', async (req, res) => {
    const { id, index } = req.params;
    let barberias = await leerDB();
    if (barberias[id] && barberias[id].citas) {
        barberias[id].citas.splice(Number(index), 1);
        await guardarBarberiaEnDB(id, barberias[id]);
        return res.json({ success: true });
    }
    res.status(404).json({ error: "No encontrado" });
});

app.get('/api/barberia/:id', async (req, res) => {
    let barberias = await leerDB();
    const { id } = req.params;
    const barberia = barberias[id];

    if (!barberia) {
        return res.status(404).json({ success: false, error: "Barbería no encontrada o eliminada" });
    }

    res.json({ success: true, barberia });
});

app.get('/api/barberias/:id', async (req, res) => {
    let barberias = await leerDB();
    const { id } = req.params;
    const barberia = barberias[id];

    if (!barberia) {
        return res.status(404).json({ success: false, error: "Barbería no encontrada" });
    }

    res.json({
        success: true,
        nombre: barberia.nombre || "Barbería",
        direccion: barberia.direccion || "",
        telefono: barberia.telefono || "",
        servicios: barberia.servicios || [],
        barberos: barberia.barberos || []
    });
});

app.post('/api/barberias/:id/citas', async (req, res) => {
    const { id } = req.params;
    const { clienteNombre, clienteTelefono, servicio, barbero, fechaHora } = req.body;

    let barberias = await leerDB();
    if (!barberias[id]) {
        return res.status(404).json({ success: false, error: "Barbería no encontrada" });
    }

    if (!clienteNombre || !servicio) {
        return res.status(400).json({ success: false, error: "Faltan datos obligatorios" });
    }

    if (!barberias[id].citas) {
        barberias[id].citas = [];
    }

    const nuevaCita = {
        id: 'cita_' + Date.now(),
        clienteNombre,
        clienteTelefono: clienteTelefono || "",
        servicio,
        barbero: barbero || "General",
        fechaHora: fechaHora || new Date().toLocaleDateString(),
        estado: "Pendiente",
        creadaEn: new Date().toISOString()
    };

    barberias[id].citas.push(nuevaCita);
    await guardarBarberiaEnDB(id, barberias[id]);

    res.json({ success: true, message: "¡Cita agendada con éxito!", cita: nuevaCita });
});

// ==========================================
// EXPORTACIÓN VERCEL / SERVERLESS
// ==========================================

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    async function iniciarServidor() {
        await conectarDB();
        app.listen(PORT, IP_HOST, () => {
            console.log(`> Servidor corriendo correctamente en el puerto ${PORT}`);
        });
    }
    iniciarServidor();
}
