"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const CATEGORIES = [
  {
    name: "Petición",
    description:
      "Pide que la entidad haga, entregue o reconozca algo: un trámite, un documento, un servicio o un derecho.",
  },
  {
    name: "Reclamo",
    description:
      "Expresa inconformidad porque un servicio o un trámite se prestó mal, tarde o no se prestó.",
  },
  {
    name: "Denuncia",
    description:
      "Informa una conducta posiblemente irregular o ilegal de servidores o de particulares para que se investigue.",
  },
  {
    name: "Solicitud de información",
    description:
      "Pregunta cómo hacer algo o pide datos (requisitos, horarios, estado de un trámite), sin pedir que la entidad actúe.",
  },
] as const;

export function CategoryHelp() {
  return (
    <Collapsible className="rounded-lg border p-3">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="group w-full justify-between">
          ¿Qué significa cada categoría?
          <ChevronDown
            aria-hidden="true"
            className="transition-transform group-data-[state=open]:rotate-180"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-2 pt-2">
        <dl className="grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((category) => (
            <div key={category.name}>
              <dt className="font-medium">{category.name}</dt>
              <dd className="text-sm text-muted-foreground">{category.description}</dd>
            </div>
          ))}
        </dl>
      </CollapsibleContent>
      <p className="mt-3 rounded-md bg-muted p-3 text-sm">
        <strong>Confusión más frecuente:</strong> pedir que la entidad <em>entregue o haga</em> algo
        es una <strong>Petición</strong>; preguntar <em>cómo hacerlo</em> o pedir información es una{" "}
        <strong>Solicitud de información</strong>.
      </p>
    </Collapsible>
  );
}
