import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { generateOutreach, type OutreachMessages } from "@/lib/outreach.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles, Mail, Linkedin, Copy, Check, Loader2, User } from "lucide-react";

type Contact = { name: string; role: string };

type Props = {
  companyName: string;
  industry?: string | null;
  hq?: string | null;
  triggerSummary?: string | null;
  fitReasoning?: string | null;
  expansionSignals?: string[];
  outOfHqCountries?: string[];
  contacts: Contact[];
};

export function OutreachComposer(props: Props) {
  const { contacts } = props;
  const [active, setActive] = useState<string | null>(contacts[0]?.role ?? null);
  const [drafts, setDrafts] = useState<Record<string, OutreachMessages>>({});
  const [edits, setEdits] = useState<Record<string, Partial<OutreachMessages>>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const generate = useServerFn(generateOutreach);

  const mut = useMutation({
    mutationFn: async (c: Contact) =>
      generate({
        data: {
          companyName: props.companyName,
          industry: props.industry ?? null,
          hq: props.hq ?? null,
          triggerSummary: props.triggerSummary ?? null,
          fitReasoning: props.fitReasoning ?? null,
          expansionSignals: props.expansionSignals ?? [],
          outOfHqCountries: props.outOfHqCountries ?? [],
          contactName: c.name,
          contactRole: c.role,
        },
      }),
    onSuccess: (data, c) => {
      setDrafts((p) => ({ ...p, [c.role]: data }));
      setEdits((p) => ({ ...p, [c.role]: {} }));
      setActive(c.role);
    },
  });

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  if (contacts.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-xs text-muted-foreground">
        No contacts on file for this company.
      </div>
    );
  }

  const activeContact = contacts.find((c) => c.role === active);
  const draft = active ? drafts[active] : undefined;
  const edit = active ? edits[active] ?? {} : {};
  const merged = draft && {
    problemStatements: draft.problemStatements,
    emailSubject: edit.emailSubject ?? draft.emailSubject,
    emailBody: edit.emailBody ?? draft.emailBody,
    linkedinMessage: edit.linkedinMessage ?? draft.linkedinMessage,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] divide-y md:divide-y-0 md:divide-x">
      {/* contact list */}
      <ul className="py-2">
        {contacts.map((c) => {
          const has = !!drafts[c.role];
          const isActive = c.role === active;
          return (
            <li key={c.role}>
              <button
                onClick={() => setActive(c.role)}
                className={`w-full text-left px-4 py-2.5 text-xs hover:bg-muted/40 transition-colors flex items-start gap-2.5 ${
                  isActive ? "bg-muted/60" : ""
                }`}
              >
                <User className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-muted-foreground text-[10px] uppercase tracking-wide mt-0.5">
                    {c.role}
                  </div>
                </div>
                {has && (
                  <Check className="h-3 w-3 text-[var(--score-hot)] shrink-0 mt-1" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* composer */}
      <div className="p-5 space-y-4">
        {!activeContact ? (
          <div className="text-xs text-muted-foreground">Select a contact.</div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{activeContact.name}</div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  {activeContact.role}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => mut.mutate(activeContact)}
                disabled={mut.isPending}
              >
                {mut.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {draft ? "Regenerate" : "Generate messages"}
              </Button>
            </div>

            {mut.isError && (
              <div className="text-xs text-destructive">
                {(mut.error as Error)?.message || "Failed to generate."}
              </div>
            )}

            {!merged && !mut.isPending && (
              <div className="text-xs text-muted-foreground border border-dashed rounded-md p-4">
                Click <span className="font-medium">Generate messages</span> to draft a role-specific
                email and LinkedIn DM tied to the trigger event and how GoGlobal helps.
              </div>
            )}

            {merged && (
              <>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">
                    Problem statements for {activeContact.role}
                  </div>
                  <ul className="space-y-1">
                    {merged.problemStatements.map((p, i) => (
                      <li key={i} className="text-xs flex gap-2">
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] shrink-0">
                          {i + 1}
                        </Badge>
                        <span className="text-foreground/90">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Email */}
                <div className="rounded-md border bg-card">
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copy(
                          "email",
                          `Subject: ${merged.emailSubject}\n\n${merged.emailBody}`,
                        )
                      }
                    >
                      {copied === "email" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy
                    </Button>
                  </div>
                  <div className="p-3 space-y-2">
                    <Input
                      value={merged.emailSubject}
                      onChange={(e) =>
                        setEdits((p) => ({
                          ...p,
                          [active!]: { ...p[active!], emailSubject: e.target.value },
                        }))
                      }
                      className="text-xs h-8"
                    />
                    <Textarea
                      value={merged.emailBody}
                      onChange={(e) =>
                        setEdits((p) => ({
                          ...p,
                          [active!]: { ...p[active!], emailBody: e.target.value },
                        }))
                      }
                      rows={6}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* LinkedIn */}
                <div className="rounded-md border bg-card">
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <Linkedin className="h-3.5 w-3.5" /> LinkedIn DM
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copy("li", merged.linkedinMessage)}
                    >
                      {copied === "li" ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      Copy & Mark Sent
                    </Button>
                  </div>
                  <div className="p-3">
                    <Textarea
                      value={merged.linkedinMessage}
                      onChange={(e) =>
                        setEdits((p) => ({
                          ...p,
                          [active!]: { ...p[active!], linkedinMessage: e.target.value },
                        }))
                      }
                      rows={3}
                      className="text-xs"
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
