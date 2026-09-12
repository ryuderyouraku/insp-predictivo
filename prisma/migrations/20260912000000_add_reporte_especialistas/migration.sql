-- AlterTable
ALTER TABLE "Reporte" ALTER COLUMN "especialista" DROP NOT NULL;

-- CreateTable
CREATE TABLE "_ReporteEspecialistas" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ReporteEspecialistas_AB_unique" ON "_ReporteEspecialistas"("A", "B");

-- CreateIndex
CREATE INDEX "_ReporteEspecialistas_B_index" ON "_ReporteEspecialistas"("B");

-- AddForeignKey
ALTER TABLE "_ReporteEspecialistas" ADD CONSTRAINT "_ReporteEspecialistas_A_fkey" FOREIGN KEY ("A") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReporteEspecialistas" ADD CONSTRAINT "_ReporteEspecialistas_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
