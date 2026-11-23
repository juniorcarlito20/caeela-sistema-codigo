import { seed } from './seed'
import { prisma } from './prisma'

seed()
  .then(async () => {
    console.log('Seed concluído.')
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Seed falhou:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
