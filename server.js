const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const path = require('path');
const fs = require('fs');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', true);

// =========================================================
// RUTA DINÁMICA DE MANIFIESTOS DESDE EL ÚNICO MANIFEST.JSON
// =========================================================
app.get('/manifest.json', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'manifest.json');
        const fileContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        res.setHeader('Content-Type', 'application/json');
        
        // Si la petición viene rotulada como cliente, entrega la sección clientes
        if (req.query.tipo === 'cliente') {
            return res.json(fileContent.clientes);
        }
        // Por defecto entrega la sección de administración para barberos
        res.json(fileContent.barberos_admin);
    } catch (err) {
        res.status(500).json({ error: "Error al leer manifest.json" });
    }
});

// VISTAS Y ARCHIVOS ESTÁTICOS
app.get('/registro.html', (req, res) => res.sendFile(path.join(__dirname, 'registro.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/superadmin.html', (req, res) => res.sendFile(path.join(__dirname, 'superadmin.html')));
app.get('/cliente.html', (req, res) => res.sendFile(path.join(__dirname, 'cliente.html')));

app.use(express.static('.', { index: false }));

const PORT = process.env.PORT || 3000;
const uri = process.env.MONGO_URI || "mongodb+srv://andersoncorreacardona4_db_user:7MInK4js3yK8CUQb@barverinnovationsistem.hd0sfnq.mongodb.net/?retryWrites=true&w=majority&appName=barverinnovationsistem";

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
});

let db;
async function conectarDB() {
    try {
        await client.connect();
        db = client.db("barverinnovationsistem");
        console.log("¡Conectado exitosamente a MongoDB Atlas!");
    } catch (error) {
        console.error("Error al conectar con MongoDB:", error);
    }
}

async function leerDB() {
    try {
        if (!db) return {};
        const docs = await db.collection('barberias').find({}).toArray();
        let obj = {};
        docs.forEach(doc => { obj[doc.idUnico || doc._id.toString()] = doc; });
        return obj;
    } catch (error) {
        return {};
    }
}

async function guardarBarberiaEnDB(idUnico, data) {
    try {
        await db.collection('barberias').updateOne({ idUnico }, { $set: data }, { upsert: true });
    } catch (error) {
        console.error("Error guardando:", error);
    }
}

// ROUTING PRINCIPAL
app.get('/', (req, res) => {
    const { id } = req.query;
    if (id) {
        return res.sendFile(path.join(__dirname, 'cliente.html'));
    } else {
        return res.sendFile(path.join(__dirname, 'registro.html'));
    }
});

// APIS DE REGISTRO Y SUPERADMIN RESTAURADAS
app.post('/api/barberias', async (req, res) => {
    let { nombre, direccion, telefono, pin } = req.body;
    if (!nombre) return res.status(400).json({ success: false, error: "Nombre obligatorio" });

    let barberias = await leerDB();
    let idBase = nombre.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let idUnico = idBase, contador = 1;
    while (barberias[idUnico]) { idUnico = `${idBase}-${contador}`; contador++; }

    let hoy = new Date();
    hoy.setDate(hoy.getDate() + 30);
    let fechaPrueba = hoy.toISOString().split('T')[0];

    let nuevaBarberia = {
        idUnico, nombre, direccion: direccion || "", telefono: telefono || "",
        pin: String(pin || "1234").trim(),
        suscripcionActivaHasta: fechaPrueba,
        activa: true,
        servicios: [{ nombre: "corte clásico", precio: 20000 }],
        barberos: [], citas: [], inventario: []
    };

    await guardarBarberiaEnDB(idUnico, nuevaBarberia);
    res.json({ success: true, barberiaId: idUnico });
});

app.get('/api/superadmin/barberias', async (req, res) => {
    let barberias = await leerDB();
    let totalRegistradas = Object.keys(barberias).length;
    let barberiasActivas = 0;
    const hoy = new Date().toISOString().split('T')[0];
    const hostUrl = `${req.protocol}://${req.get('host')}`;

    const lista = Object.keys(barberias).map(id => {
        let b = barberias[id];
        let vencimiento = b.suscripcionActivaHasta || b.fechaVencimiento || hoy;
        let porFecha = vencimiento >= hoy;
        let estadoActivo = (b.activa !== undefined) ? (b.activa && porFecha) : porFecha;

        if (estadoActivo) barberiasActivas++;

        return {
            id: id,
            nombre: b.nombre || id,
            pin: b.pin || "1234",
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
        barberias: lista
    });
});

app.get('/api/barberias/:id', async (req, res) => {
    let barberias = await leerDB();
    const barberia = barberias[req.params.id];
    if (!barberia) return res.status(404).json({ success: false, error: "No encontrada" });
    res.json({ success: true, nombre: barberia.nombre, servicios: barberia.servicios, barberos: barberia.barberos });
});

app.post('/api/barberias/:id/citas', async (req, res) => {
    let barberias = await leerDB();
    let barberia = barberias[req.params.id];
    if (!barberia) return res.status(404).json({ success: false, error: "No encontrada" });

    if (!barberia.citas) barberia.citas = [];
    barberia.citas.push({ ...req.body, estado: "Pendiente", creadaEn: new Date().toISOString() });
    await guardarBarberiaEnDB(req.params.id, barberia);
    res.json({ success: true });
});

async function iniciar() {
    await conectarDB();
    app.listen(PORT, '0.0.0.0', () => console.log(`Servidor activo en puerto ${PORT}`));
}
iniciar();
