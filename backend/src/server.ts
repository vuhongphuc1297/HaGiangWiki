import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/database.js';

const server = app.listen(env.PORT);

server.on('listening', () => {
  console.info(`\n  HaGiangWiki API đã sẵn sàng!`);
  console.info(`  API:      http://localhost:${env.PORT}`);
  console.info(`  Health:   http://localhost:${env.PORT}/api/health`);
  console.info(`  Frontend: ${env.CLIENT_URL}\n`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === 'EADDRINUSE'
      ? `Cổng ${env.PORT} đang được sử dụng. Hãy dừng ứng dụng đang chiếm cổng rồi chạy lại.`
      : `Không thể khởi động HaGiangWiki API: ${error.message}`,
  );
  process.exit(1);
});

function shutdown() {
  console.info('\nĐang dừng HaGiangWiki API…');
  server.close(() => {
    void prisma.$disconnect().then(() => process.exit(0), () => process.exit(1));
  });
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
