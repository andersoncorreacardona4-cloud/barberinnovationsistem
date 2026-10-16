const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para leer JSON y formularios
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (HTML, iconos, manifiestos) desde la raíz del proyecto
app.use(express.static(path.join(__dirname)));

// Conexión a MongoDB Atlas con manejo seguro de tiempos de espera y errores
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://andersoncorreacardona4_db_user:7MInK4js3yK8CUQb@barverinnovationsistem.hd0sfnq.mongodb.net/?retryWrites=true&w=majority&appName=barverinnovationsistem";

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000, // Tiempo límite de espera de 10 segundos
    socketTimeoutMS: 45000,
})
.then(() => console.log("🟢 Conectado exitosamente a MongoDB Atlas"))
.catch(err => console.error("🔴 Error al conectar a MongoDB:", err));

// Esquema y Modelo de Barbería
const barberiaSchema = new mongoose.Schema({
    nombre: { type: String, required: true },
    direccion: { type: String },
    telefono: { type: String },
    pin: { type: String, required: true },
    fechaCreacion: { type: Date, default: Date.now }
});

const Barberia = mongoose.model('Barberia', barberiaSchema);

// Endpoint /ping para verificar estado y evitar suspensiones por inactividad
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Ruta para registrar una nueva barbería con control de errores completo
app.post('/api/barberias', async (req, res) => {
    try {
        const { nombre, direccion, telefono, pin } = req.body;
        
        if (!nombre || !pin) {
            return res.status(400).json({ success: false, error: 'El nombre y el PIN son obligatorios.' });
        }

        const nuevaBarberia = new Barberia({ nombre, direccion, telefono, pin });
        await nuevaBarberia.save();

        res.status(201).json({ 
            success: true, 
            message: 'Barbería registrada con éxito', 
            barberiaId: nuevaBarberia._id 
        });
    } catch (error) {
        console.error("Error en el registro de barbería:", error);
        res.status(500).json({ success: false, error: 'Error interno del servidor al registrar la barbería.' });
    }
});

// Ruta principal para el registro
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'registro.html'));
});

// Iniciar servidor escuchando el puerto asignado por la plataforma (Railway / Render / Local)
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
});
