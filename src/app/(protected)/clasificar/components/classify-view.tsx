"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEngineSelection, useModels } from "@/lib/models/use-models";
import { CategoryHelp } from "./category-help";
import { EngineSelector } from "./engine-selector";
import { SingleTab } from "./single-tab";

export function ClassifyView() {
  const modelsQuery = useModels();
  const [engine, setEngine] = useEngineSelection(modelsQuery.data);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Clasificar</h1>
      <EngineSelector query={modelsQuery} value={engine} onChange={setEngine} />
      <CategoryHelp />
      <Tabs defaultValue="individual" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="lote">Lote (CSV)</TabsTrigger>
        </TabsList>
        <TabsContent value="individual">
          <SingleTab engine={engine} models={modelsQuery.data} />
        </TabsContent>
        <TabsContent value="lote">
          <p className="text-muted-foreground">Próximamente.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
