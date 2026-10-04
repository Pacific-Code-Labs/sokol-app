import { useEffect } from "react";
import { BookOpen, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useLang } from "@/contexts/LangContext";
import { useAssistant } from "@/contexts/AssistantContext";

const topics = ["evaluate", "project", "electrical", "followup"] as const;

export default function AssistantGuide() {
  const { tr } = useLang();
  const assistant = useAssistant();
  useEffect(() => {
    assistant.setPageContext({ page: "other" });
    assistant.setInput({});
  }, [assistant.setPageContext, assistant.setInput]);
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <BookOpen className="h-8 w-8 text-primary" aria-hidden />
        <h2 className="text-2xl font-bold">{tr.guide_title}</h2>
        <p className="max-w-3xl text-muted-foreground">{tr.guide_intro}</p>
      </header>
      <Card>
        <CardHeader><CardTitle>{tr.guide_recipe_title}</CardTitle><CardDescription>{tr.guide_recipe_desc}</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>{tr.guide_goal}</li>
            <li>{tr.guide_context}</li>
            <li>{tr.guide_details}</li>
            <li>{tr.guide_followup}</li>
          </ol>
          <p className="rounded-lg bg-muted p-3">{tr.guide_missing}</p>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {topics.map(topic => (
          <Card key={topic} className="flex flex-col">
            <CardHeader><CardTitle className="text-lg">{tr[`guide_${topic}_title`]}</CardTitle><CardDescription>{tr[`guide_${topic}_desc`]}</CardDescription></CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <blockquote className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed">{tr[`guide_${topic}_prompt`]}</blockquote>
              <p className="text-sm text-muted-foreground">{tr[`guide_${topic}_outcome`]}</p>
              <Button className="mt-auto self-start gap-2" variant="outline" onClick={() => {
                assistant.setChatInput(tr[`guide_${topic}_prompt`]);
                assistant.setOpen(true);
              }}><MessageCircle className="h-4 w-4" />{tr.guide_try}</Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{tr.guide_try_hint}</p>
      <Card>
        <CardHeader><CardTitle>{tr.guide_review_title}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground"><p>{tr.guide_review}</p><p>{tr.guide_limits}</p></CardContent>
      </Card>
    </div>
  );
}
