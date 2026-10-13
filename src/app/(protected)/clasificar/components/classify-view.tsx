"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isBatchActive } from "@/lib/batch/batch-machine";
import { useBatchRunner } from "@/lib/batch/use-batch-runner";
import { useEngineSelection, useModels } from "@/lib/models/use-models";
import { BatchTab } from "./batch-tab";
import { CategoryHelp } from "./category-help";
import { EngineSelector } from "./engine-selector";
import { SingleTab } from "./single-tab";

export function ClassifyView() {
  const modelsQuery = useModels();
  const [engine, setEngine] = useEngineSelection(modelsQuery.data);
  // El lote vive aquí (y las pestañas se montan siempre) para no perderlo al cambiar de pestaña.
  const { state: batchState, runner } = useBatchRunner();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Clasificar</h1>
      <EngineSelector
        query={modelsQuery}
        value={engine}
        onChange={setEngine}
        locked={isBatchActive(batchState.phase)}
      />
      <CategoryHelp />
      <Tabs defaultValue="individual" className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="individual">Individual</TabsTrigger>
          <TabsTrigger value="lote">Lote (CSV)</TabsTrigger>
        </TabsList>
        <TabsContent value="individual" forceMount className="data-[state=inactive]:hidden">
          <SingleTab engine={engine} models={modelsQuery.data} />
        </TabsContent>
        <TabsContent value="lote" forceMount className="data-[state=inactive]:hidden">
          <BatchTab engine={engine} models={modelsQuery.data} state={batchState} runner={runner} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
