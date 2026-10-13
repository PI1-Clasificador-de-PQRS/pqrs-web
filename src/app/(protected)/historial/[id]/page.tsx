import type { Metadata } from "next";
import { ClassificationDetail } from "./classification-detail";

export const metadata: Metadata = { title: "Detalle · Historial · Clasificador de PQRS" };

export default async function ClassificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassificationDetail id={id} />;
}
