import type { AgentProvider } from '../../../settings/types/types';
import type { AgentContext } from '../../../settings/view/tabs/agents-settings/types';
import AccountContent from '../../../settings/view/tabs/agents-settings/sections/content/AccountContent';

const PROVIDERS: AgentProvider[] = ['claude', 'gemini', 'codex', 'cursor'];

type AgentConnectionsStepProps = {
  agentContextById: Record<AgentProvider, AgentContext>;
};

export default function AgentConnectionsStep({
  agentContextById,
}: AgentConnectionsStepProps) {
  return (
    <div className="space-y-6">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-2xl font-bold text-foreground">Connect Your AI Agents</h2>
        <p className="text-muted-foreground">
          Login to one or more AI coding assistants. All are optional.
        </p>
      </div>

      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const ctx = agentContextById[provider];
          return (
            <AccountContent
              key={provider}
              agent={provider}
              authStatus={ctx.authStatus}
              installStatus={ctx.installStatus}
              apiKeyStatus={ctx.apiKeyStatus}
              onLogin={ctx.onLogin}
              onInstall={ctx.onInstall}
              onUninstall={ctx.onUninstall}
              onValidateApiKey={ctx.onValidateApiKey}
              onResetApiKeyValidation={ctx.onResetApiKeyValidation}
            />
          );
        })}
      </div>

      <div className="pt-2 text-center text-sm text-muted-foreground">
        <p>You can configure these later in Settings.</p>
      </div>
    </div>
  );
}
