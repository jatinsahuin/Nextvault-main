import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { createSource, getSourceStatus, processIngestion } from './src/services/ingestion/ingestion.js';

const fastify = Fastify({ logger: true });

fastify.register(cors, {
    origin: true // Allows your frontend to talk to the backend
});
fastify.register(multipart);

// Mock User ID for the Vertical Slice
const MOCK_USER_ID = '00000000-0000-0000-0000-000000000000';

fastify.post('/sources', async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    try {
        const { sourceId, status } = await createSource(MOCK_USER_ID, data, {});
        // Trigger background processing
        processIngestion(sourceId).catch(err => console.error('Background processing error:', err));

        return reply.status(202).send({
            jobId: `job-${Date.now()}`,
            sourceId,
            status
        });
    } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: err.message });
    }
});

fastify.get('/sources/:id/status', async (request, reply) => {
    try {
        const status = await getSourceStatus(request.params.id, MOCK_USER_ID);
        return { sourceId: request.params.id, status };
    } catch (err) {
        return reply.status(404).send({ error: err.message });
    }
});

const start = async () => {
    try {
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log('NextVault Backend running on http://localhost:3000');
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
