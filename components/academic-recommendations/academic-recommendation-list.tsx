import type { AcademicRecommendation } from "@/types/academic-recommendations";

type AcademicRecommendationListProps = {
  recommendations: AcademicRecommendation[];
  embedded?: boolean;
};

export function AcademicRecommendationList({ recommendations, embedded = false }: AcademicRecommendationListProps) {
  if (recommendations.length === 0) {
    return null;
  }

  const content = (
    <div className="reader-ai-academic-list">
      {recommendations.map((recommendation) => (
        <article className="reader-ai-academic-item" key={recommendation.id}>
          <div className="reader-ai-academic-heading">
            <p className="reader-ai-academic-title">{recommendation.title}</p>
            <p className="reader-ai-academic-meta">
              {recommendation.scholarOrSource} · {recommendation.sourceName}
              {recommendation.year ? ` · ${recommendation.year}` : ""}
            </p>
          </div>
          <p className="reader-ai-academic-summary">{recommendation.summary}</p>
          <p className="reader-ai-academic-relation">{recommendation.relation}</p>
          {recommendation.url ? (
            <a className="reader-ai-academic-link" href={recommendation.url} rel="noreferrer" target="_blank">
              查看来源
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <details className="reader-ai-academic">
      <summary>学术关联 ({recommendations.length})</summary>
      {content}
    </details>
  );
}
