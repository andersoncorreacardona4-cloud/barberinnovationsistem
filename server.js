const dns = require('dns');
// Configurar servidores DNS públicos para evitar bloqueos de resolución en Render
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const path = require('path');
const fs = require('fs');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', true);

// Endpoint rápido para monitoreo
app.get('/ping', (req, res) => {
    res.status(200).send('Servidor activo');
});

// ==========================================
// SERVIR MANIFIESTOS PWA (FÍSICOS SEPARADOS)
// ==========================================
app.get('/manifest.json', (req, res) => {
    const filePath = path.join(__dirname, 'manifest.json');
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }
    res.status(404).json({ error: "manifest.json no encontrado" });
});

app.get('/manifest-cliente.json', (req, res) => {
    const filePath = path.join(__dirname, 'manifest-cliente.json');
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }
    res.status(404).json({ error: "manifest-cliente.json no encontrado" });
});

// ==========================================
// RUTAS DE VISTAS ESTÁTICAS
// ==========================================
app.get('/registro.html', (req, res) => res.sendFile(path.join(__dirname, 'registro.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/superadmin.html', (req, res) => res.sendFile(path.join(__dirname, 'superadmin.html')));
app.get('/cliente.html', (req, res) => res.sendFile(path.join(__dirname, 'cliente.html')));

app.use(express.static('.', { index: false }));

const PORT = process.env.PORT || 3000;
const uri = process.env.MONGO_URI || "mongodb+srv://andersoncorreacardona4_db_user:7MInK4js3yK8CUQb@barverinnovationsistem.hd0sfnq.mongodb.net/?retryWrites=true&w=majority&appName=barverinnovationsistem";

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  connectTimeoutMS: 8000, // Límite de 8 segundos para conectar
  serverSelectionTimeoutMS: 8000
});

let db;
async function conectarDB() {
    try {
        await client.connect();
        db = client.db("barverinnovationsistem");
        console.log("✅ ¡Conectado exitosamente a MongoDB Atlas!");
    } catch (error) {
        console.error("❌ Error conectando a MongoDB Atlas:", error);
    }
}

async function leerDB() {
    try {
        if (!db) {
            await conectarDB();
        }
        if (!db) return {};
        const docs = await db.collection('barberias').find({}).toArray();
        let obj = {};
        docs.forEach(doc => { 
            let id = doc.idUnico || doc._id.toString();
            obj[id] = doc; 
        });
        return obj;
    } catch (error) {
        console.error("Error leyendo DB:", error);
        return {};
    }
}

async function guardarBarberiaEnDB(idUnico, data) {
    try {
        if (!db) await conectarDB();
        if (db) {
            await db.collection('barberias').updateOne({ idUnico }, { $set: data }, { upsert: true });
        }
    } catch (error) {
        console.error("Error guardando en DB:", error);
    }
}

// ==========================================
// ROUTING PRINCIPAL
// ==========================================
app.get('/', (req, res) => {
    const { id } = req.query;
    if (id) {
        return res.sendFile(path.join(__dirname, 'cliente.html'));
    }
    return res.sendFile(path.join(__dirname, 'registro.html'));
});

// ==========================================
// API DE REGISTRO CON TRY/CATCH Y RESPUESTA GARANTIZADA
// ==========================================
app.post('/api/barberias', async (req, res) => {
    try {
        let { nombre, direccion, telefono, pin } = req.body;
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({ success: false, error: "El nombre del local es obligatorio" });
        }

        let barberias = await leerDB();
        let idBase = nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
        if (!idBase) idBase = 'barberia-' + Date.now();
        
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
            idUnico, 
            nombre: nombre.trim(), 
            direccion: direccion || "", 
            telefono: telefono || "",
            pin: String(pin || "1234").trim(),
            suscripcionActivaHasta: fechaPrueba,
            activa: true,
            servicios: [{ nombre: "corte clásico", precio: 20000 }],
            barberos: [], 
            citas: [], 
            inventario: []
        };

        await guardarBarberiaEnDB(idUnico, nuevaBarberia);

        // Responder INMEDIATAMENTE al cliente
        return res.json({ 
            success: true, 
            barberiaId: idUnico,
            message: "Barbería registrada correctamente" 
        });

    } catch (err) {
        console.error("Error crítico en registro:", err);
        // Garantiza que la petición no se quede colgada
        return res.status(500).json({ 
            success: false, 
            error: "Error interno en el servidor. Intenta de nuevo." 
        });
    }
});

app.get('/api/superadmin/barberias', async (req, res) => {
    try {
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
    } catch (err) {
        res.status(500).json({ success: false, error: "Error al obtener barberías" });
    }
});

app.get('/api/barberias/:id', async (req, res) => {
    try {
        let barberias = await leerDB();
        const barberia = barberias[req.params.id];
        if (!barberia) return res.status(404).json({ success: false, error: "No encontrada" });
        res.json({ success: true, nombre: barberia.nombre, servicios: barberia.servicios, barberos: barberia.barberos });
    } catch (err) {
        res.status(500).json({ success: false, error: "Error al obtener la barbería" });
    }
});

app.post('/api/barberias/:id/citas', async (req, res) => {
    try {
        let barberias = await leerDB();
        let barberia = barberias[req.params.id];
        if (!barberia) return res.status(404).json({ success: false, error: "No encontrada" });

        if (!barberia.citas) barberia.citas = [];
        barberia.citas.push({ ...req.body, estado: "Pendiente", creadaEn: new Date().toISOString() });
        await guardarBarberiaEnDB(req.params.id, barberia);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: "Error al agendar la cita" });
    }
});

async function iniciar() {
    await conectarDB();
    app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Servidor activo en puerto ${PORT}`));
}
iniciar();
