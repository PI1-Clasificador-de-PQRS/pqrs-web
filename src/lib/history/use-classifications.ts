"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api/client";
import { rangeError, toClassificationsQuery, type HistoryState } from "@/lib/history/filters";

export function useClassifications(state: HistoryState) {
  const query = toClassificationsQuery(state);
  return useQuery({
    queryKey: ["classifications", query],
    queryFn: ({ signal }) => unwrap(api.GET("/classifications", { params: { query }, signal })),
    // Al cambiar de página o de filtros se siguen viendo los datos anteriores mientras carga.
    placeholderData: keepPreviousData,
    enabled: rangeError(state) === null,
  });
}

export function useClassification(id: string) {
  return useQuery({
    queryKey: ["classification", id],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/classifications/{classification_id}", {
          params: { path: { classification_id: id } },
          signal,
        }),
      ),
  });
}
