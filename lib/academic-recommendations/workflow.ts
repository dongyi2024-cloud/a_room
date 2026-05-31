import "server-only";

import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import {
  buildAcademicRecommendationCacheKey,
  cacheAcademicRecommendations,
  getCachedAcademicRecommendations
} from "@/lib/academic-recommendations/data";
import {
  buildAcademicRetrievalQueriesFromKeywords,
  buildAcademicSearchKeywords
} from "@/lib/academic-recommendations/keywords";
import { createTrustedAcademicProvider } from "@/lib/academic-recommendations/providers";
import { detectAcademicTrigger } from "@/lib/academic-recommendations/trigger";
import {
  buildAcademicSourceLeads,
  filterVerifiedAcademicCandidates,
  toAcademicRecommendation
} from "@/lib/academic-recommendations/validation";
import { loadAiMemoryContext } from "@/lib/memory/data";
import type {
  AcademicRecommendation,
  AcademicRecommendationRequest,
  AcademicRecommendationResult,
  AcademicRetrievalProvider,
  AcademicRetrievalQuery,
  AcademicSearchKeywordResult,
  AcademicSourceCandidate,
  AcademicTriggerDecision
} from "@/types/academic-recommendations";

const MAX_RECOMMENDATIONS = 3;
const ACADEMIC_RETRIEVAL_TIMEOUT_MS = Number.parseInt(
  process.env.ACADEMIC_RECOMMENDATION_TIMEOUT_MS?.trim() || "6500",
  10
);

const AcademicRecommendationState = Annotation.Root({
  request: Annotation<AcademicRecommendationRequest>(),
  provider: Annotation<AcademicRetrievalProvider>(),
  trigger: Annotation<AcademicTriggerDecision>(),
  cacheKey: Annotation<string>(),
  memoryContext: Annotation<string>(),
  keywordResult: Annotation<AcademicSearchKeywordResult | null>(),
  queries: Annotation<AcademicRetrievalQuery[]>(),
  candidates: Annotation<AcademicSourceCandidate[]>(),
  verifiedCandidates: Annotation<AcademicSourceCandidate[]>(),
  recommendations: Annotation<AcademicRecommendation[]>(),
  sourceLeads: Annotation<AcademicRecommendationResult["sourceLeads"]>(),
  emptyReason: Annotation<AcademicRecommendationResult["emptyReason"]>()
});

async function loadCachedResult(state: {
  request: AcademicRecommendationRequest;
  trigger: AcademicTriggerDecision;
  cacheKey: string;
}) {
  if (!state.trigger.shouldRetrieve) {
    return null;
  }

  try {
    return await getCachedAcademicRecommendations({
      userId: state.request.userId,
      bookId: state.request.bookId,
      cacheKey: state.cacheKey,
      trigger: state.trigger
    });
  } catch {
    return null;
  }
}

function rankRecommendations(candidates: AcademicSourceCandidate[], themes: string[]) {
  return candidates
    .slice(0, MAX_RECOMMENDATIONS)
    .map((candidate, index) => toAcademicRecommendation(candidate, themes[index % themes.length] ?? themes[0] ?? "学术主题"));
}

function buildValidationThemes(trigger: AcademicTriggerDecision, keywordResult: AcademicSearchKeywordResult | null | undefined) {
  if (!keywordResult) {
    return trigger.themes;
  }

  return Array.from(new Set([...trigger.themes, ...Object.values(keywordResult.keywords).flat()])).slice(0, 20);
}

export async function runAcademicRecommendationWorkflow(
  request: AcademicRecommendationRequest,
  provider: AcademicRetrievalProvider = createTrustedAcademicProvider(),
  options: {
    timeoutMs?: number;
    allowedProviders?: string[];
  } = {}
): Promise<AcademicRecommendationResult> {
  const workflow = new StateGraph(AcademicRecommendationState)
    .addNode("classifyAcademicTrigger", async (state) => {
      const trigger = detectAcademicTrigger(state.request);
      return {
        trigger,
        cacheKey: buildAcademicRecommendationCacheKey(state.request, trigger.themes),
        emptyReason: trigger.shouldRetrieve ? undefined : "not_relevant"
      };
    })
    .addNode("loadMemoryPreferenceGuidance", async (state) => {
      if (!state.trigger.shouldRetrieve) {
        return {
          memoryContext: ""
        };
      }

      try {
        return {
          memoryContext: await loadAiMemoryContext(state.request.userId)
        };
      } catch {
        return {
          memoryContext: ""
        };
      }
    })
    .addNode("buildAcademicSearchKeywords", async (state) => {
      if (!state.trigger.shouldRetrieve) {
        return {
          keywordResult: null,
          queries: []
        };
      }

      const cached = await loadCachedResult(state);

      if (cached) {
        return {
          recommendations: cached.recommendations,
          keywordResult: null,
          queries: []
        };
      }

      const keywordResult = await buildAcademicSearchKeywords(state.request, state.trigger);

      return {
        keywordResult
      };
    })
    .addNode("buildAcademicQueries", async (state) => {
      if (!state.trigger.shouldRetrieve || !state.keywordResult || state.recommendations.length > 0) {
        return {
          queries: []
        };
      }

      return {
        queries: buildAcademicRetrievalQueriesFromKeywords(state.keywordResult, state.trigger)
      };
    })
    .addNode("retrieveTrustedSources", async (state) => {
      if (!state.trigger.shouldRetrieve || state.queries.length === 0 || state.recommendations.length > 0) {
        return {};
      }

      try {
        const candidates = await state.provider.search(state.queries, {
          timeoutMs:
            Number.isFinite(options.timeoutMs) && options.timeoutMs && options.timeoutMs > 0
              ? options.timeoutMs
              : Number.isFinite(ACADEMIC_RETRIEVAL_TIMEOUT_MS) && ACADEMIC_RETRIEVAL_TIMEOUT_MS > 0
              ? ACADEMIC_RETRIEVAL_TIMEOUT_MS
              : 6500,
          maxResults: 10,
          allowedProviders: options.allowedProviders
        });
        const sourceLeads = buildAcademicSourceLeads(candidates);

        if (process.env.NODE_ENV !== "production") {
          console.info("[academic-workflow] retrieved candidates", {
            candidateCount: candidates.length,
            sourceLeadCount: sourceLeads.length,
            providers: Array.from(new Set(candidates.map((candidate) => candidate.provider)))
          });
        }

        return {
          candidates,
          sourceLeads
        };
      } catch {
        return {
          candidates: [],
          sourceLeads: [],
          emptyReason: "provider_unavailable" as const
        };
      }
    })
    .addNode("validateAcademicCandidates", async (state) => {
      if (!state.trigger.shouldRetrieve || state.recommendations.length > 0) {
        return {};
      }

      return {
        verifiedCandidates: filterVerifiedAcademicCandidates(
          state.candidates,
          buildValidationThemes(state.trigger, state.keywordResult)
        ),
        sourceLeads: state.sourceLeads.length > 0 ? state.sourceLeads : buildAcademicSourceLeads(state.candidates)
      };
    })
    .addNode("rankAcademicRecommendations", async (state) => {
      if (!state.trigger.shouldRetrieve || state.recommendations.length > 0) {
        return {};
      }

      const recommendations = rankRecommendations(state.verifiedCandidates, buildValidationThemes(state.trigger, state.keywordResult));

      return {
        recommendations,
        emptyReason: recommendations.length > 0 ? undefined : state.emptyReason ?? "no_reliable_sources"
      };
    })
    .addNode("cacheVerifiedRecommendations", async (state) => {
      if (!state.trigger.shouldRetrieve || state.recommendations.length === 0) {
        return {};
      }

      try {
        await cacheAcademicRecommendations({
          request: state.request,
          cacheKey: state.cacheKey,
          trigger: state.trigger,
          recommendations: state.recommendations
        });
      } catch {
        return {};
      }

      return {};
    })
    .addEdge(START, "classifyAcademicTrigger")
    .addEdge("classifyAcademicTrigger", "loadMemoryPreferenceGuidance")
    .addEdge("loadMemoryPreferenceGuidance", "buildAcademicSearchKeywords")
    .addEdge("buildAcademicSearchKeywords", "buildAcademicQueries")
    .addEdge("buildAcademicQueries", "retrieveTrustedSources")
    .addEdge("retrieveTrustedSources", "validateAcademicCandidates")
    .addEdge("validateAcademicCandidates", "rankAcademicRecommendations")
    .addEdge("rankAcademicRecommendations", "cacheVerifiedRecommendations")
    .addEdge("cacheVerifiedRecommendations", END)
    .compile();

  const result = await workflow.invoke({
    request,
    provider,
    trigger: {
      shouldRetrieve: false,
      reasons: [],
      themes: []
    },
    cacheKey: "",
    memoryContext: "",
    keywordResult: null,
    queries: [],
    candidates: [],
    verifiedCandidates: [],
    recommendations: [],
    sourceLeads: [],
    emptyReason: undefined
  });

  return {
    shouldDisplay: result.recommendations.length > 0,
    trigger: result.trigger,
    recommendations: result.recommendations,
    sourceLeads: result.sourceLeads,
    emptyReason: result.recommendations.length > 0 ? undefined : result.emptyReason ?? "no_reliable_sources"
  };
}
