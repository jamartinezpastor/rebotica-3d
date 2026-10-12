import { urlMedicamentos } from './cima';

// Esqueleto del job nocturno. La descarga real llega en F1-02 y la sincronización diaria en F1-03.
const destino = urlMedicamentos({ receta: false, comercializados: true, autorizados: true });
console.log(`sync-cima: pendiente de implementar (F1-02). Primera consulta prevista: ${destino}`);
