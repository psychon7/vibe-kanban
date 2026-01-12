# AI Services Architecture

> **Document Type:** AI Services Specification (Source of Truth)
> **Created:** 2026-01-13
> **Updated:** 2026-01-13
> **Stack:** Cloudflare Workers, AI Gateway, LLM Providers (OpenAI, Anthropic)
> **Dependencies:** backend-specs.md (PromptEnhancement, PromptTemplate, PromptEnhancementSettings entities)

---

## 0. Cloudflare AI Gateway Overview

### 0.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CLOUDFLARE AI GATEWAY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────┐     ┌──────────────────┐     ┌─────────────────┐       │
│   │ Workers API   │────>│  AI Gateway      │────>│ OpenAI API      │       │
│   │ (Prompt       │     │  • Caching       │     │ (gpt-4-turbo)   │       │
│   │  Enhancement) │     │  • Rate limiting │     └─────────────────┘       │
│   └───────────────┘     │  • Logging       │     ┌─────────────────┐       │
│                         │  • Analytics     │────>│ Anthropic API   │       │
│                         │  • Fallback      │     │ (claude-3)      │       │
│                         └──────────────────┘     └─────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 0.2 AI Gateway Benefits

| Feature | Benefit |
|---------|---------|
| **Caching** | Cache identical prompts, reduce costs by 30-50% |
| **Rate Limiting** | Built-in rate limits per user/workspace |
| **Logging** | Full request/response logging for debugging |
| **Analytics** | Token usage, latency, cost dashboards |
| **Fallback** | Automatic failover between providers |
| **Real-time Logs** | Stream logs to Workers KV or external services |

### 0.3 Gateway Configuration

```typescript
// wrangler.toml
[ai]
binding = "AI"

[[ai.gateway]]
id = "vibe-kanban-ai"
binding = "AI_GATEWAY"

// src/services/ai-gateway.ts
import { Ai } from '@cloudflare/ai';

export async function enhancePrompt(
  ai: Ai,
  prompt: string,
  settings: PromptEnhancementSettings
): Promise<EnhancementResult> {
  const response = await ai.run('@cf/openai/gpt-4-turbo', {
    messages: [
      { role: 'system', content: ENHANCEMENT_SYSTEM_PROMPT },
      { role: 'user', content: buildEnhancementPrompt(prompt, settings) },
    ],
    max_tokens: 2000,
  }, {
    gateway: {
      id: 'vibe-kanban-ai',
      skipCache: false,
      cacheTtl: 3600, // 1 hour cache for identical prompts
    },
  });

  return parseEnhancementResponse(response);
}
```

### 0.4 Provider Configuration

```typescript
// AI Gateway providers (configured in Cloudflare Dashboard)
const PROVIDERS = {
  openai: {
    endpoint: 'https://api.openai.com/v1',
    models: ['gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1',
    models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  },
  workers_ai: {
    // Cloudflare's own models (optional fallback)
    models: ['@cf/meta/llama-3-8b-instruct'],
  },
};
```

---

## 1. AI Feature Inventory

### 1.1 Feature 1: Prompt Enhancement

**User Value:** Transform vague or incomplete task prompts into well-structured instructions that AI coding agents can execute more effectively.

**Input:**
- Original prompt: string (user-provided task description)
- Task context: Task entity (title, description, project info)
- Codebase context: file structure, key patterns (optional)
- Git history: recent commits, branch info (optional)
- Enhancement settings: PromptEnhancementSettings entity

**Output:**
- Enhanced prompt: string (structured, detailed prompt)
- Original score: 0-100 (quality of original)
- Enhanced score: 0-100 (quality of enhanced)
- Techniques applied: array of enhancement techniques used
- Side-by-side comparison: original vs enhanced

**Latency Target:** < 5 seconds p95 (per brief requirements)

**Quality Target:**
- Score improvement: > 20 points average
- Acceptance rate: > 60% users accept enhanced prompt
- Edit rate: < 40% users modify enhanced prompt

**Data Dependencies:**
- Requires: original prompt text
- Optional: project file structure, git history, custom instructions

**Risks:**
- Hallucination: Enhanced prompt adds requirements not implied by original
- Over-engineering: Enhancement makes simple tasks unnecessarily complex
- Context leakage: Sensitive code patterns exposed to external LLM

---

### 1.2 Feature 2: Prompt Quality Scoring

**User Value:** Provide immediate feedback on prompt quality before sending to AI coding agents, helping users write better prompts over time.

**Input:**
- Prompt text: string
- Scoring rubric: predefined criteria

**Output:**
- Overall score: 0-100
- Component scores: clarity, specificity, context, actionability (0-25 each)
- Improvement suggestions: array of specific recommendations

**Latency Target:** < 1 second p95 (can run locally with rules)

**Quality Target:**
- Correlation: > 0.7 with human quality ratings
- Consistency: Same prompt scores within +/- 5 points

**Data Dependencies:**
- Requires: prompt text only
- Optional: none (stateless scoring)

**Risks:**
- Gaming: Users optimize for score rather than actual quality
- Bias: Scoring favors certain prompt styles

---

### 1.3 Feature 3: Codebase Context Extraction

**User Value:** Automatically gather relevant codebase context to improve prompt enhancement without manual effort.

**Input:**
- Project path: string (local filesystem)
- Depth limit: integer (default: 3 levels)
- File patterns: array of globs to include/exclude

**Output:**
- File tree: structured directory listing
- Key files: README, package.json, Cargo.toml, etc.
- Code patterns: detected languages, frameworks, conventions
- Context summary: text summary for LLM consumption

**Latency Target:** < 2 seconds for typical project (< 10,000 files)

**Quality Target:**
- Coverage: Capture 80% of relevant structural information
- Accuracy: Correct language/framework detection > 95%

**Data Dependencies:**
- Requires: filesystem access to project directory
- Optional: .gitignore for filtering

**Risks:**
- Performance: Large repositories slow down extraction
- Privacy: Sensitive files included in context

---

### 1.4 Feature 4: Git History Context (Optional)

**User Value:** Include recent development activity to provide better context for task prompts.

**Input:**
- Repository path: string
- Commit limit: integer (default: 10)
- Branch filter: string (optional)

**Output:**
- Recent commits: array of commit messages with metadata
- Changed files: files modified in recent history
- Branch context: current branch, upstream info
- Activity summary: text summary of recent work

**Latency Target:** < 1 second p95

**Quality Target:**
- Relevance: Commit messages extracted accurately
- Recency: Only recent, relevant commits included

**Data Dependencies:**
- Requires: git repository with history
- Optional: branch specification

**Risks:**
- Noise: Irrelevant commits pollute context
- Size: Long commit messages bloat token usage

---

## 2. Model Gateway Architecture

### 2.1 Provider Abstraction Layer

**Why:** Abstract LLM provider differences, enable provider switching without code changes, centralize API key management, and provide unified error handling.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Model Gateway                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐    ┌──────────────────────────────────────────┐   │
│  │   Request   │───>│          Provider Router                  │   │
│  │   Handler   │    │  (routes based on workspace settings)     │   │
│  └─────────────┘    └───────────────┬──────────────────────────┘   │
│                                     │                               │
│                     ┌───────────────┼───────────────┐               │
│                     │               │               │               │
│                     ▼               ▼               ▼               │
│              ┌───────────┐   ┌───────────┐   ┌───────────┐         │
│              │  OpenAI   │   │ Anthropic │   │  Ollama   │         │
│              │  Adapter  │   │  Adapter  │   │  Adapter  │         │
│              └─────┬─────┘   └─────┬─────┘   └─────┬─────┘         │
│                    │               │               │                │
│                    ▼               ▼               ▼                │
│              ┌───────────┐   ┌───────────┐   ┌───────────┐         │
│              │  OpenAI   │   │ Anthropic │   │  Local    │         │
│              │   API     │   │    API    │   │  Ollama   │         │
│              └───────────┘   └───────────┘   └───────────┘         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Provider Configuration

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub openai: Option<OpenAIConfig>,
    pub anthropic: Option<AnthropicConfig>,
    pub ollama: Option<OllamaConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAIConfig {
    pub model: String,              // "gpt-4-turbo", "gpt-4o", "gpt-4o-mini"
    pub max_tokens: u32,            // 2000 default
    pub temperature: f32,           // 0.7 default
    pub timeout_ms: u32,            // 30000 default
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnthropicConfig {
    pub model: String,              // "claude-3-opus", "claude-3-sonnet", "claude-3-haiku"
    pub max_tokens: u32,            // 2000 default
    pub temperature: f32,           // 0.7 default
    pub timeout_ms: u32,            // 30000 default
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaConfig {
    pub model: String,              // "llama3", "mistral", "codellama"
    pub endpoint: String,           // "http://localhost:11434"
    pub max_tokens: u32,            // 2000 default
    pub timeout_ms: u32,            // 60000 default (local models slower)
}
```

### 2.3 Unified Provider Trait

```rust
#[async_trait]
pub trait LLMProvider: Send + Sync {
    /// Generate text completion
    async fn complete(&self, request: CompletionRequest) -> Result<CompletionResponse, LLMError>;

    /// Check provider availability
    async fn health_check(&self) -> Result<ProviderHealth, LLMError>;

    /// Get provider name
    fn name(&self) -> &str;

    /// Get estimated cost per 1K tokens (input, output)
    fn cost_per_1k_tokens(&self) -> (f64, f64);
}

#[derive(Debug, Clone)]
pub struct CompletionRequest {
    pub system_prompt: String,
    pub user_prompt: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub stop_sequences: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct CompletionResponse {
    pub content: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub model: String,
    pub latency_ms: u64,
    pub finish_reason: FinishReason,
}

#[derive(Debug, Clone)]
pub enum FinishReason {
    Stop,
    MaxTokens,
    Error(String),
}
```

### 2.4 Request Routing Strategy

```rust
impl ModelGateway {
    pub async fn route_request(
        &self,
        request: CompletionRequest,
        settings: &PromptEnhancementSettings,
    ) -> Result<CompletionResponse, LLMError> {
        // 1. Determine preferred provider from workspace settings
        let provider_name = &settings.preferred_model;

        // 2. Get provider adapter
        let provider = self.get_provider(provider_name)?;

        // 3. Attempt request with primary provider
        match provider.complete(request.clone()).await {
            Ok(response) => Ok(response),
            Err(primary_error) => {
                // 4. Fallback to next available provider
                self.fallback_request(request, provider_name, primary_error).await
            }
        }
    }

    async fn fallback_request(
        &self,
        request: CompletionRequest,
        failed_provider: &str,
        original_error: LLMError,
    ) -> Result<CompletionResponse, LLMError> {
        // Fallback chain priority: OpenAI -> Anthropic -> Ollama
        let fallback_chain = ["openai", "anthropic", "ollama"];

        for provider_name in fallback_chain {
            if provider_name == failed_provider {
                continue;
            }

            if let Some(provider) = self.providers.get(provider_name) {
                if provider.health_check().await.is_ok() {
                    match provider.complete(request.clone()).await {
                        Ok(response) => {
                            warn!(
                                primary = %failed_provider,
                                fallback = %provider_name,
                                "Used fallback provider"
                            );
                            return Ok(response);
                        }
                        Err(_) => continue,
                    }
                }
            }
        }

        // All providers failed
        Err(original_error)
    }
}
```

### 2.5 Credential Management

**Storage:** macOS Keychain via Electron safe storage

```rust
pub struct CredentialManager {
    keychain_service: String, // "com.vibekanban.credentials"
}

impl CredentialManager {
    /// Store API key securely
    pub async fn store_api_key(&self, provider: &str, key: &str) -> Result<(), KeychainError>;

    /// Retrieve API key
    pub async fn get_api_key(&self, provider: &str) -> Result<Option<String>, KeychainError>;

    /// Delete API key
    pub async fn delete_api_key(&self, provider: &str) -> Result<(), KeychainError>;

    /// List stored providers
    pub async fn list_providers(&self) -> Result<Vec<String>, KeychainError>;
}
```

**Keychain Item Structure:**
```
Service: com.vibekanban.credentials
Account: {provider_name}  // "openai", "anthropic"
Password: {api_key}       // encrypted at rest by macOS
```

---

## 3. Prompt Enhancement Pipeline

### 3.1 Pipeline Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                    Prompt Enhancement Pipeline                         │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐   ┌────────────────┐   ┌─────────────────────────┐ │
│  │   Original   │──>│    Context     │──>│      Enhancement        │ │
│  │    Prompt    │   │   Gathering    │   │        Engine           │ │
│  └──────────────┘   └───────┬────────┘   └───────────┬─────────────┘ │
│                             │                        │               │
│                             ▼                        ▼               │
│                     ┌───────────────┐        ┌─────────────┐        │
│                     │   Codebase    │        │   Quality   │        │
│                     │   Context     │        │   Scoring   │        │
│                     └───────┬───────┘        └──────┬──────┘        │
│                             │                       │                │
│                             ▼                       ▼                │
│                     ┌───────────────┐        ┌─────────────┐        │
│                     │  Git History  │        │  Enhanced   │        │
│                     │   (optional)  │        │   Prompt    │        │
│                     └───────────────┘        └─────────────┘        │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### 3.2 Context Gathering

#### 3.2.1 Codebase Context Extractor

```rust
#[derive(Debug, Clone)]
pub struct CodebaseContext {
    pub file_tree: FileTree,
    pub detected_languages: Vec<Language>,
    pub detected_frameworks: Vec<Framework>,
    pub key_files: Vec<KeyFile>,
    pub conventions: Vec<Convention>,
    pub summary: String,
}

#[derive(Debug, Clone)]
pub struct FileTree {
    pub root: String,
    pub directories: Vec<String>,
    pub files: Vec<FileInfo>,
    pub total_files: usize,
    pub total_size_bytes: u64,
}

#[derive(Debug, Clone)]
pub struct KeyFile {
    pub path: String,
    pub file_type: KeyFileType,
    pub content_preview: Option<String>, // First 500 chars
}

#[derive(Debug, Clone)]
pub enum KeyFileType {
    Readme,
    PackageJson,
    CargoToml,
    Dockerfile,
    Makefile,
    GitIgnore,
    EnvExample,
    TsConfig,
    EslintConfig,
}

impl CodebaseContextExtractor {
    pub async fn extract(
        &self,
        project_path: &Path,
        depth_limit: usize,
    ) -> Result<CodebaseContext, ContextError> {
        // 1. Respect .gitignore
        let ignore_patterns = self.load_gitignore(project_path)?;

        // 2. Build file tree (limited depth)
        let file_tree = self.build_file_tree(project_path, depth_limit, &ignore_patterns)?;

        // 3. Detect languages from file extensions
        let languages = self.detect_languages(&file_tree)?;

        // 4. Detect frameworks from key files
        let frameworks = self.detect_frameworks(&file_tree)?;

        // 5. Extract key files
        let key_files = self.extract_key_files(&file_tree)?;

        // 6. Identify conventions
        let conventions = self.identify_conventions(&file_tree, &key_files)?;

        // 7. Generate summary
        let summary = self.generate_summary(&file_tree, &languages, &frameworks)?;

        Ok(CodebaseContext {
            file_tree,
            detected_languages: languages,
            detected_frameworks: frameworks,
            key_files,
            conventions,
            summary,
        })
    }
}
```

#### 3.2.2 Git History Context Extractor

```rust
#[derive(Debug, Clone)]
pub struct GitContext {
    pub current_branch: String,
    pub recent_commits: Vec<CommitInfo>,
    pub changed_files: Vec<String>,
    pub summary: String,
}

#[derive(Debug, Clone)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: DateTime<Utc>,
    pub files_changed: usize,
}

impl GitContextExtractor {
    pub async fn extract(
        &self,
        repo_path: &Path,
        commit_limit: usize,
    ) -> Result<GitContext, ContextError> {
        // 1. Get current branch
        let branch = self.get_current_branch(repo_path)?;

        // 2. Get recent commits
        let commits = self.get_recent_commits(repo_path, commit_limit)?;

        // 3. Get changed files from recent commits
        let changed_files = self.get_changed_files(&commits)?;

        // 4. Generate summary
        let summary = self.generate_summary(&branch, &commits)?;

        Ok(GitContext {
            current_branch: branch,
            recent_commits: commits,
            changed_files,
            summary,
        })
    }
}
```

### 3.3 Enhancement Engine

```rust
pub struct EnhancementEngine {
    gateway: Arc<ModelGateway>,
    template_service: Arc<TemplateService>,
}

impl EnhancementEngine {
    pub async fn enhance(
        &self,
        original_prompt: &str,
        context: EnhancementContext,
        settings: &PromptEnhancementSettings,
    ) -> Result<EnhancementResult, EnhancementError> {
        // 1. Score original prompt
        let original_score = self.score_prompt(original_prompt).await?;

        // 2. Build enhancement request
        let system_prompt = self.build_system_prompt(&context, settings)?;
        let user_prompt = self.build_user_prompt(original_prompt, &context)?;

        // 3. Call LLM via gateway
        let request = CompletionRequest {
            system_prompt,
            user_prompt,
            max_tokens: 2000,
            temperature: 0.7,
            stop_sequences: vec![],
        };

        let response = self.gateway.route_request(request, settings).await?;

        // 4. Parse enhanced prompt
        let enhanced = self.parse_enhancement(&response.content)?;

        // 5. Score enhanced prompt
        let enhanced_score = self.score_prompt(&enhanced.prompt).await?;

        // 6. Record techniques applied
        let techniques = self.identify_techniques(&original_prompt, &enhanced.prompt)?;

        Ok(EnhancementResult {
            original_prompt: original_prompt.to_string(),
            enhanced_prompt: enhanced.prompt,
            original_score,
            enhanced_score,
            techniques_applied: techniques,
            model_used: response.model,
            tokens_used: response.input_tokens + response.output_tokens,
            latency_ms: response.latency_ms,
        })
    }
}
```

### 3.4 Enhancement System Prompt

```rust
const ENHANCEMENT_SYSTEM_PROMPT: &str = r#"
You are an expert prompt engineer specializing in creating clear, actionable prompts for AI coding agents. Your task is to enhance user prompts to maximize the effectiveness of AI coding assistants.

## Enhancement Guidelines

1. **Goal Clarification**: Extract and clearly state the primary objective
2. **Context Injection**: Add relevant technical context when available
3. **Requirement Structuring**: Break down into specific, actionable requirements
4. **Success Criteria**: Define what "done" looks like
5. **Constraint Specification**: Note any limitations or boundaries
6. **Edge Case Enumeration**: List potential edge cases to handle
7. **Output Format**: Specify expected deliverables

## Enhancement Style: {{enhancement_style}}

{{#if style_minimal}}
- Keep enhancements concise
- Focus only on critical clarifications
- Preserve original intent exactly
{{/if}}

{{#if style_balanced}}
- Add moderate structure and detail
- Balance clarity with brevity
- Include success criteria
{{/if}}

{{#if style_comprehensive}}
- Provide detailed, thorough enhancement
- Include all relevant context
- Enumerate edge cases
- Define complete success criteria
{{/if}}

## Available Context

{{#if codebase_context}}
### Codebase Structure
{{codebase_summary}}

### Key Technologies
{{technologies}}
{{/if}}

{{#if git_context}}
### Recent Activity
{{git_summary}}
{{/if}}

{{#if custom_instructions}}
### Team-Specific Guidelines
{{custom_instructions}}
{{/if}}

## Output Format

Respond with JSON in this exact format:
```json
{
  "enhanced_prompt": "The improved prompt text",
  "goal": "Clear statement of the primary objective",
  "requirements": ["Requirement 1", "Requirement 2"],
  "success_criteria": ["Criterion 1", "Criterion 2"],
  "context_notes": "Additional context for the agent"
}
```
"#;
```

---

## 4. Prompt Templates System

### 4.1 Template Syntax

Templates use Handlebars-style `{{placeholder}}` syntax:

```
{{task_title}} - Task title
{{task_description}} - Original task description
{{project_name}} - Project name
{{file_paths}} - Relevant file paths (comma-separated)
{{language}} - Primary programming language
{{framework}} - Primary framework
{{custom_context}} - User-provided context
```

### 4.2 Built-in Templates

#### 4.2.1 Bug Fix Template

```handlebars
## Bug Fix: {{task_title}}

### Problem Description
{{task_description}}

### Expected Behavior
[Describe what should happen]

### Current Behavior
[Describe what currently happens]

### Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Relevant Files
{{file_paths}}

### Technical Context
- Language: {{language}}
- Framework: {{framework}}

### Success Criteria
- [ ] Bug is fixed
- [ ] Existing tests pass
- [ ] No regressions introduced
- [ ] Root cause identified and documented
```

#### 4.2.2 Feature Implementation Template

```handlebars
## Feature: {{task_title}}

### Overview
{{task_description}}

### User Story
As a [user type], I want [goal] so that [benefit].

### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

### Technical Requirements
- Language: {{language}}
- Framework: {{framework}}
- Key Files: {{file_paths}}

### Implementation Notes
{{custom_context}}

### Out of Scope
- [What this feature should NOT do]

### Testing Requirements
- [ ] Unit tests for new logic
- [ ] Integration tests if applicable
- [ ] Edge cases handled
```

#### 4.2.3 Refactoring Template

```handlebars
## Refactoring: {{task_title}}

### Current State
{{task_description}}

### Target State
[Describe the desired code structure]

### Motivation
- [ ] Improve readability
- [ ] Reduce complexity
- [ ] Improve performance
- [ ] Enable future features

### Files to Refactor
{{file_paths}}

### Constraints
- Maintain backward compatibility
- No functional changes
- Keep test coverage

### Success Criteria
- [ ] All tests pass
- [ ] Code review approved
- [ ] No new warnings/errors
- [ ] Documentation updated
```

#### 4.2.4 Documentation Template

```handlebars
## Documentation: {{task_title}}

### Scope
{{task_description}}

### Documentation Type
- [ ] API documentation
- [ ] User guide
- [ ] Developer guide
- [ ] README
- [ ] Inline comments

### Target Audience
[Who will read this documentation]

### Files to Document
{{file_paths}}

### Required Sections
- Overview
- Getting Started
- API Reference (if applicable)
- Examples
- Troubleshooting

### Success Criteria
- [ ] Clear and concise
- [ ] Accurate and up-to-date
- [ ] Includes examples
- [ ] Follows project style
```

#### 4.2.5 Test Writing Template

```handlebars
## Testing: {{task_title}}

### Scope
{{task_description}}

### Test Type
- [ ] Unit tests
- [ ] Integration tests
- [ ] End-to-end tests
- [ ] Performance tests

### Files to Test
{{file_paths}}

### Test Cases Required
1. Happy path: [Description]
2. Edge case: [Description]
3. Error handling: [Description]

### Technical Context
- Language: {{language}}
- Framework: {{framework}}
- Test Framework: [e.g., Jest, pytest, cargo test]

### Success Criteria
- [ ] All test cases implemented
- [ ] Tests pass consistently
- [ ] Good code coverage
- [ ] Tests are maintainable
```

### 4.3 Template Service

```rust
impl TemplateService {
    /// Get all templates for a workspace (global + custom)
    pub async fn list_templates(
        &self,
        workspace_team_id: Option<Uuid>,
    ) -> Result<Vec<PromptTemplate>, TemplateError>;

    /// Render template with variables
    pub fn render_template(
        &self,
        template: &PromptTemplate,
        variables: &HashMap<String, String>,
    ) -> Result<String, TemplateError>;

    /// Create custom template
    pub async fn create_template(
        &self,
        workspace_team_id: Uuid,
        input: CreateTemplateInput,
    ) -> Result<PromptTemplate, TemplateError>;

    /// Validate template syntax
    pub fn validate_template(&self, template_text: &str) -> Result<(), TemplateError>;

    /// Increment usage counter
    pub async fn record_usage(&self, template_id: Uuid) -> Result<(), TemplateError>;
}
```

---

## 5. Enhancement Techniques

### 5.1 Technique Catalog

| Technique | Description | When Applied |
|-----------|-------------|--------------|
| Goal Extraction | Identify and state the primary objective | Always |
| Context Injection | Add codebase/git context | When context available |
| Requirement Structuring | Break into bullet points | Multi-part tasks |
| Constraint Specification | Add technical constraints | Complex tasks |
| Success Criteria | Define "done" | All tasks |
| Edge Case Enumeration | List edge cases | Bug fixes, features |
| Output Format | Specify deliverables | When format matters |
| Example Addition | Add code examples | Complex patterns |
| Scope Boundary | Define out-of-scope | Large features |

### 5.2 Technique Detection

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EnhancementTechnique {
    GoalExtraction,
    ContextInjection,
    RequirementStructuring,
    ConstraintSpecification,
    SuccessCriteriaDefinition,
    EdgeCaseEnumeration,
    OutputFormatSpecification,
    ExampleAddition,
    ScopeBoundaryDefinition,
}

impl EnhancementEngine {
    fn identify_techniques(
        &self,
        original: &str,
        enhanced: &str,
    ) -> Vec<EnhancementTechnique> {
        let mut techniques = vec![];

        // Goal extraction: Enhanced has explicit goal section
        if enhanced.contains("## Goal") || enhanced.contains("### Objective") {
            techniques.push(EnhancementTechnique::GoalExtraction);
        }

        // Context injection: Enhanced has codebase/tech context
        if enhanced.contains("Language:") || enhanced.contains("Framework:") {
            techniques.push(EnhancementTechnique::ContextInjection);
        }

        // Requirement structuring: Enhanced has bullet points
        let original_bullets = original.matches("- ").count();
        let enhanced_bullets = enhanced.matches("- ").count();
        if enhanced_bullets > original_bullets + 2 {
            techniques.push(EnhancementTechnique::RequirementStructuring);
        }

        // Success criteria: Enhanced has success/done section
        if enhanced.contains("Success Criteria") || enhanced.contains("[ ]") {
            techniques.push(EnhancementTechnique::SuccessCriteriaDefinition);
        }

        // Edge cases: Enhanced mentions edge cases
        if enhanced.to_lowercase().contains("edge case") {
            techniques.push(EnhancementTechnique::EdgeCaseEnumeration);
        }

        // Output format: Enhanced specifies format
        if enhanced.contains("Output:") || enhanced.contains("Format:") {
            techniques.push(EnhancementTechnique::OutputFormatSpecification);
        }

        // Scope boundary: Enhanced has out-of-scope section
        if enhanced.contains("Out of Scope") || enhanced.contains("Not included") {
            techniques.push(EnhancementTechnique::ScopeBoundaryDefinition);
        }

        techniques
    }
}
```

---

## 6. Quality Scoring Rubric

### 6.1 Scoring Components

| Component | Weight | Criteria |
|-----------|--------|----------|
| Clarity | 0-25 | Is the goal clear and unambiguous? |
| Specificity | 0-25 | Are requirements detailed enough? |
| Context | 0-25 | Is sufficient context provided? |
| Actionability | 0-25 | Can an agent act on this immediately? |

### 6.2 Scoring Rules

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptScore {
    pub total: u8,           // 0-100
    pub clarity: u8,         // 0-25
    pub specificity: u8,     // 0-25
    pub context: u8,         // 0-25
    pub actionability: u8,   // 0-25
    pub suggestions: Vec<ScoringSuggestion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoringSuggestion {
    pub component: ScoreComponent,
    pub suggestion: String,
    pub priority: SuggestionPriority,
}

impl PromptScorer {
    pub fn score(&self, prompt: &str) -> PromptScore {
        let clarity = self.score_clarity(prompt);
        let specificity = self.score_specificity(prompt);
        let context = self.score_context(prompt);
        let actionability = self.score_actionability(prompt);

        let suggestions = self.generate_suggestions(
            prompt, clarity, specificity, context, actionability
        );

        PromptScore {
            total: clarity + specificity + context + actionability,
            clarity,
            specificity,
            context,
            actionability,
            suggestions,
        }
    }

    fn score_clarity(&self, prompt: &str) -> u8 {
        let mut score = 0u8;

        // Has clear action verb (5 points)
        let action_verbs = ["create", "fix", "add", "remove", "update", "refactor", "implement"];
        if action_verbs.iter().any(|v| prompt.to_lowercase().contains(v)) {
            score += 5;
        }

        // Has specific subject (5 points)
        if prompt.len() > 20 && !prompt.contains("something") && !prompt.contains("stuff") {
            score += 5;
        }

        // Single clear goal (5 points)
        let sentences = prompt.split('.').count();
        if sentences <= 3 {
            score += 5;
        }

        // No ambiguous words (5 points)
        let ambiguous = ["maybe", "perhaps", "somehow", "etc", "and so on"];
        if !ambiguous.iter().any(|w| prompt.to_lowercase().contains(w)) {
            score += 5;
        }

        // Proper sentence structure (5 points)
        if prompt.chars().next().map_or(false, |c| c.is_uppercase()) {
            score += 5;
        }

        score.min(25)
    }

    fn score_specificity(&self, prompt: &str) -> u8 {
        let mut score = 0u8;

        // Contains file paths or function names (7 points)
        if prompt.contains('/') || prompt.contains("()") || prompt.contains(".rs") || prompt.contains(".ts") {
            score += 7;
        }

        // Contains specific values or examples (6 points)
        if prompt.contains('"') || prompt.contains('`') {
            score += 6;
        }

        // Bullet points or numbered list (6 points)
        if prompt.contains("- ") || prompt.contains("1.") {
            score += 6;
        }

        // Adequate length for detail (6 points)
        if prompt.len() > 100 {
            score += 6;
        }

        score.min(25)
    }

    fn score_context(&self, prompt: &str) -> u8 {
        let mut score = 0u8;

        // Mentions technology/framework (8 points)
        let techs = ["react", "rust", "typescript", "python", "node", "tailwind"];
        if techs.iter().any(|t| prompt.to_lowercase().contains(t)) {
            score += 8;
        }

        // Mentions file or module (8 points)
        if prompt.contains("file") || prompt.contains("module") || prompt.contains("component") {
            score += 8;
        }

        // Provides background (9 points)
        let context_words = ["because", "since", "currently", "when", "after"];
        if context_words.iter().any(|w| prompt.to_lowercase().contains(w)) {
            score += 9;
        }

        score.min(25)
    }

    fn score_actionability(&self, prompt: &str) -> u8 {
        let mut score = 0u8;

        // Imperative mood (8 points)
        let imperatives = ["create", "add", "fix", "update", "implement", "write", "remove"];
        if imperatives.iter().any(|v| prompt.to_lowercase().starts_with(v)) {
            score += 8;
        }

        // No questions (5 points)
        if !prompt.contains('?') {
            score += 5;
        }

        // Has success criteria or expected outcome (7 points)
        if prompt.contains("should") || prompt.contains("must") || prompt.contains("expect") {
            score += 7;
        }

        // Self-contained (5 points)
        if !prompt.contains("see above") && !prompt.contains("as mentioned") {
            score += 5;
        }

        score.min(25)
    }
}
```

### 6.3 Score Interpretation

| Score Range | Quality Level | Recommendation |
|-------------|--------------|----------------|
| 0-25 | Poor | Enhancement strongly recommended |
| 26-50 | Fair | Enhancement recommended |
| 51-75 | Good | Enhancement optional |
| 76-100 | Excellent | No enhancement needed |

---

## 7. Safety Guardrails

### 7.1 PII Detection and Handling

```rust
#[derive(Debug, Clone)]
pub struct PIIDetector {
    patterns: Vec<PIIPattern>,
}

#[derive(Debug, Clone)]
pub struct PIIPattern {
    pub name: String,
    pub regex: Regex,
    pub action: PIIAction,
}

#[derive(Debug, Clone)]
pub enum PIIAction {
    Redact,      // Replace with [REDACTED]
    Warn,        // Log warning but allow
    Block,       // Block the request
}

impl PIIDetector {
    pub fn new() -> Self {
        Self {
            patterns: vec![
                PIIPattern {
                    name: "email".into(),
                    regex: Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap(),
                    action: PIIAction::Warn,
                },
                PIIPattern {
                    name: "api_key".into(),
                    regex: Regex::new(r"(sk-|pk_|api[_-]?key)[a-zA-Z0-9]{20,}").unwrap(),
                    action: PIIAction::Block,
                },
                PIIPattern {
                    name: "aws_key".into(),
                    regex: Regex::new(r"AKIA[0-9A-Z]{16}").unwrap(),
                    action: PIIAction::Block,
                },
                PIIPattern {
                    name: "private_key".into(),
                    regex: Regex::new(r"-----BEGIN (RSA |EC )?PRIVATE KEY-----").unwrap(),
                    action: PIIAction::Block,
                },
                PIIPattern {
                    name: "password".into(),
                    regex: Regex::new(r"password\s*[:=]\s*['\"][^'\"]+['\"]").unwrap(),
                    action: PIIAction::Redact,
                },
            ],
        }
    }

    pub fn scan(&self, text: &str) -> PIIScanResult {
        let mut findings = vec![];
        let mut should_block = false;

        for pattern in &self.patterns {
            for m in pattern.regex.find_iter(text) {
                findings.push(PIIFinding {
                    pattern_name: pattern.name.clone(),
                    action: pattern.action.clone(),
                    location: (m.start(), m.end()),
                });

                if matches!(pattern.action, PIIAction::Block) {
                    should_block = true;
                }
            }
        }

        PIIScanResult {
            findings,
            should_block,
        }
    }

    pub fn redact(&self, text: &str) -> String {
        let mut result = text.to_string();

        for pattern in &self.patterns {
            if matches!(pattern.action, PIIAction::Redact) {
                result = pattern.regex.replace_all(&result, "[REDACTED]").to_string();
            }
        }

        result
    }
}
```

### 7.2 Prompt Injection Defense

```rust
pub struct InjectionDetector {
    suspicious_patterns: Vec<Regex>,
}

impl InjectionDetector {
    pub fn new() -> Self {
        Self {
            suspicious_patterns: vec![
                // Attempts to override system prompt
                Regex::new(r"(?i)ignore (previous|all|above) instructions?").unwrap(),
                Regex::new(r"(?i)forget (everything|your|the) (instructions?|rules?)").unwrap(),
                Regex::new(r"(?i)you are now").unwrap(),
                Regex::new(r"(?i)new instructions?:").unwrap(),

                // Attempts to extract system prompt
                Regex::new(r"(?i)what (are|is) your (instructions?|prompt|system)").unwrap(),
                Regex::new(r"(?i)repeat (the|your) (instructions?|prompt)").unwrap(),

                // Role-playing attacks
                Regex::new(r"(?i)pretend (to be|you are)").unwrap(),
                Regex::new(r"(?i)act as (a|an|if)").unwrap(),
            ],
        }
    }

    pub fn detect(&self, prompt: &str) -> InjectionScanResult {
        let mut findings = vec![];

        for pattern in &self.suspicious_patterns {
            if pattern.is_match(prompt) {
                findings.push(InjectionFinding {
                    pattern: pattern.as_str().to_string(),
                    severity: InjectionSeverity::Medium,
                });
            }
        }

        InjectionScanResult {
            is_suspicious: !findings.is_empty(),
            findings,
        }
    }
}
```

### 7.3 Content Policy

```rust
pub struct ContentPolicy {
    allowed_topics: Vec<String>,
    blocked_keywords: Vec<String>,
}

impl ContentPolicy {
    pub fn default() -> Self {
        Self {
            allowed_topics: vec![
                "code".into(),
                "programming".into(),
                "software".into(),
                "development".into(),
                "debugging".into(),
                "refactoring".into(),
                "testing".into(),
                "documentation".into(),
            ],
            blocked_keywords: vec![
                // Security-sensitive
                "exploit".into(),
                "vulnerability".into(),
                "bypass security".into(),
                "hack into".into(),

                // Off-topic for coding agent
                "personal advice".into(),
                "financial advice".into(),
                "medical advice".into(),
            ],
        }
    }

    pub fn check(&self, prompt: &str) -> PolicyCheckResult {
        let prompt_lower = prompt.to_lowercase();

        // Check for blocked keywords
        for keyword in &self.blocked_keywords {
            if prompt_lower.contains(keyword) {
                return PolicyCheckResult {
                    allowed: false,
                    reason: format!("Blocked keyword detected: {}", keyword),
                };
            }
        }

        PolicyCheckResult {
            allowed: true,
            reason: String::new(),
        }
    }
}
```

### 7.4 Rate Limiting

```rust
pub struct RateLimiter {
    limits: HashMap<String, RateLimit>,
    store: Arc<RwLock<HashMap<String, TokenBucket>>>,
}

#[derive(Debug, Clone)]
pub struct RateLimit {
    pub requests_per_hour: u32,
    pub tokens_per_hour: u32,
}

impl RateLimiter {
    pub fn default_limits() -> HashMap<String, RateLimit> {
        let mut limits = HashMap::new();

        // Per workspace limits
        limits.insert("workspace".into(), RateLimit {
            requests_per_hour: 100,
            tokens_per_hour: 500_000,
        });

        // Per user limits
        limits.insert("user".into(), RateLimit {
            requests_per_hour: 50,
            tokens_per_hour: 250_000,
        });

        limits
    }

    pub fn check(
        &self,
        key: &str,
        key_type: &str,
    ) -> Result<(), RateLimitError> {
        let limits = self.limits.get(key_type)
            .ok_or(RateLimitError::UnknownKeyType)?;

        let mut store = self.store.write().unwrap();
        let bucket = store.entry(format!("{}:{}", key_type, key))
            .or_insert_with(|| TokenBucket::new(limits.requests_per_hour));

        if bucket.try_consume(1) {
            Ok(())
        } else {
            Err(RateLimitError::Exceeded {
                limit: limits.requests_per_hour,
                reset_at: bucket.reset_at(),
            })
        }
    }
}
```

### 7.5 Audit Logging for AI Actions

```rust
#[derive(Debug, Clone, Serialize)]
pub struct AIAuditEntry {
    pub id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub user_id: Uuid,
    pub workspace_team_id: Option<Uuid>,
    pub action: AIAction,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub model: String,
    pub provider: String,
    pub cost_usd: f64,
    pub latency_ms: u64,
    pub success: bool,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub enum AIAction {
    PromptEnhancement {
        task_id: Uuid,
        original_length: usize,
        enhanced_length: usize,
        score_improvement: i32,
    },
    PromptScoring {
        prompt_length: usize,
        score: u8,
    },
    TemplateRendering {
        template_id: Uuid,
    },
}

impl AIAuditService {
    pub async fn log(&self, entry: AIAuditEntry) -> Result<(), AuditError> {
        // Store in audit_log table with entity_type = "prompt"
        let payload = serde_json::to_value(&entry)?;

        self.audit_service.log(
            entry.workspace_team_id,
            entry.user_id,
            "prompt",
            entry.id,
            &format!("{:?}", entry.action),
            Some(payload),
        ).await
    }

    pub async fn query_usage(
        &self,
        workspace_team_id: Uuid,
        start_date: DateTime<Utc>,
        end_date: DateTime<Utc>,
    ) -> Result<UsageSummary, AuditError> {
        // Aggregate token usage, cost, request count
        // Group by model, action type
        todo!()
    }
}
```

---

## 8. Evaluation Framework

### 8.1 A/B Testing Infrastructure

```rust
#[derive(Debug, Clone)]
pub struct ABTest {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub variants: Vec<ABVariant>,
    pub traffic_allocation: HashMap<String, f32>, // variant_id -> percentage
    pub start_date: DateTime<Utc>,
    pub end_date: Option<DateTime<Utc>>,
    pub status: ABTestStatus,
}

#[derive(Debug, Clone)]
pub struct ABVariant {
    pub id: String,
    pub name: String,
    pub config: VariantConfig,
}

#[derive(Debug, Clone)]
pub enum VariantConfig {
    PromptVersion { version: String },
    ModelSelection { model: String },
    EnhancementStyle { style: String },
    TemperatureSetting { temperature: f32 },
}

impl ABTestService {
    pub fn assign_variant(&self, test_id: Uuid, user_id: Uuid) -> Option<ABVariant> {
        let test = self.get_test(test_id)?;

        if !matches!(test.status, ABTestStatus::Running) {
            return None;
        }

        // Deterministic assignment based on user_id hash
        let hash = self.hash_user(user_id);
        let bucket = (hash % 100) as f32 / 100.0;

        let mut cumulative = 0.0;
        for (variant_id, allocation) in &test.traffic_allocation {
            cumulative += allocation;
            if bucket < cumulative {
                return test.variants.iter()
                    .find(|v| v.id == *variant_id)
                    .cloned();
            }
        }

        None
    }

    pub async fn record_outcome(
        &self,
        test_id: Uuid,
        variant_id: &str,
        user_id: Uuid,
        outcome: ABOutcome,
    ) -> Result<(), ABError> {
        // Store outcome for analysis
        todo!()
    }
}
```

### 8.2 User Feedback Collection

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancementFeedback {
    pub enhancement_id: Uuid,
    pub user_id: Uuid,
    pub action: FeedbackAction,
    pub edited_prompt: Option<String>,
    pub rating: Option<u8>,        // 1-5
    pub comments: Option<String>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FeedbackAction {
    Accepted,       // User accepted enhanced prompt as-is
    AcceptedEdited, // User accepted with modifications
    Rejected,       // User kept original prompt
    Dismissed,      // User closed without choosing
}

impl FeedbackService {
    pub async fn record_feedback(
        &self,
        enhancement_id: Uuid,
        user_id: Uuid,
        feedback: EnhancementFeedback,
    ) -> Result<(), FeedbackError> {
        // Update prompt_enhancements table
        sqlx::query!(
            r#"
            UPDATE prompt_enhancements
            SET user_accepted = ?, user_edited = ?, final_prompt = ?
            WHERE id = ?
            "#,
            matches!(feedback.action, FeedbackAction::Accepted | FeedbackAction::AcceptedEdited),
            matches!(feedback.action, FeedbackAction::AcceptedEdited),
            feedback.edited_prompt,
            enhancement_id,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_acceptance_rate(
        &self,
        workspace_team_id: Option<Uuid>,
        time_range: TimeRange,
    ) -> Result<AcceptanceRate, FeedbackError> {
        // Calculate acceptance, edit, rejection rates
        todo!()
    }
}
```

### 8.3 Quality Improvement Tracking

```rust
#[derive(Debug, Clone, Serialize)]
pub struct QualityMetrics {
    pub period: TimeRange,
    pub total_enhancements: u64,
    pub average_score_improvement: f32,
    pub acceptance_rate: f32,
    pub edit_rate: f32,
    pub rejection_rate: f32,
    pub average_latency_ms: f32,
    pub average_tokens_used: f32,
    pub average_cost_usd: f32,
    pub by_model: HashMap<String, ModelMetrics>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ModelMetrics {
    pub model: String,
    pub total_requests: u64,
    pub average_score_improvement: f32,
    pub acceptance_rate: f32,
    pub average_latency_ms: f32,
    pub average_cost_per_request: f32,
}

impl MetricsService {
    pub async fn compute_quality_metrics(
        &self,
        workspace_team_id: Option<Uuid>,
        period: TimeRange,
    ) -> Result<QualityMetrics, MetricsError> {
        // Aggregate from prompt_enhancements and audit_log
        todo!()
    }

    pub async fn compare_models(
        &self,
        period: TimeRange,
    ) -> Result<Vec<ModelMetrics>, MetricsError> {
        // Compare performance across models
        todo!()
    }
}
```

---

## 9. Cost Controls

### 9.1 Token Usage Tracking

```rust
#[derive(Debug, Clone)]
pub struct TokenTracker {
    pub pool: SqlitePool,
}

#[derive(Debug, Clone, Serialize)]
pub struct TokenUsage {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    pub estimated_cost_usd: f64,
}

impl TokenTracker {
    pub async fn record_usage(
        &self,
        workspace_team_id: Uuid,
        user_id: Uuid,
        model: &str,
        input_tokens: u32,
        output_tokens: u32,
    ) -> Result<(), TrackingError> {
        // Calculate cost based on model pricing
        let cost = self.calculate_cost(model, input_tokens, output_tokens);

        // Store in usage tracking table (or audit_log)
        sqlx::query!(
            r#"
            INSERT INTO token_usage (
                workspace_team_id, user_id, model,
                input_tokens, output_tokens, cost_usd,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            "#,
            workspace_team_id,
            user_id,
            model,
            input_tokens,
            output_tokens,
            cost,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    fn calculate_cost(&self, model: &str, input: u32, output: u32) -> f64 {
        let (input_price, output_price) = match model {
            // OpenAI pricing (per 1M tokens)
            "gpt-4-turbo" => (10.0, 30.0),
            "gpt-4o" => (5.0, 15.0),
            "gpt-4o-mini" => (0.15, 0.60),

            // Anthropic pricing (per 1M tokens)
            "claude-3-opus" => (15.0, 75.0),
            "claude-3-sonnet" => (3.0, 15.0),
            "claude-3-haiku" => (0.25, 1.25),

            // Local models
            _ => (0.0, 0.0),
        };

        let input_cost = (input as f64 / 1_000_000.0) * input_price;
        let output_cost = (output as f64 / 1_000_000.0) * output_price;

        input_cost + output_cost
    }

    pub async fn get_usage_summary(
        &self,
        workspace_team_id: Uuid,
        period: TimeRange,
    ) -> Result<TokenUsage, TrackingError> {
        // Aggregate usage for period
        todo!()
    }
}
```

### 9.2 Budget Controls (Future)

```rust
#[derive(Debug, Clone)]
pub struct BudgetConfig {
    pub workspace_team_id: Uuid,
    pub monthly_budget_usd: f64,
    pub daily_budget_usd: Option<f64>,
    pub alert_threshold_percent: f32,  // e.g., 80.0 for 80%
    pub hard_limit: bool,              // Block requests when exceeded
}

impl BudgetService {
    pub async fn check_budget(
        &self,
        workspace_team_id: Uuid,
    ) -> Result<BudgetStatus, BudgetError> {
        let config = self.get_budget_config(workspace_team_id).await?;
        let current_usage = self.get_current_month_usage(workspace_team_id).await?;

        let percent_used = (current_usage / config.monthly_budget_usd) * 100.0;

        Ok(BudgetStatus {
            budget_usd: config.monthly_budget_usd,
            used_usd: current_usage,
            percent_used,
            exceeded: percent_used >= 100.0,
            alert: percent_used >= config.alert_threshold_percent,
        })
    }

    pub async fn can_proceed(
        &self,
        workspace_team_id: Uuid,
        estimated_cost: f64,
    ) -> Result<bool, BudgetError> {
        let status = self.check_budget(workspace_team_id).await?;
        let config = self.get_budget_config(workspace_team_id).await?;

        if config.hard_limit && (status.used_usd + estimated_cost) > config.monthly_budget_usd {
            return Ok(false);
        }

        Ok(true)
    }
}
```

### 9.3 Model Selection by Complexity

```rust
#[derive(Debug, Clone)]
pub struct ModelSelector {
    complexity_classifier: ComplexityClassifier,
}

#[derive(Debug, Clone, PartialEq)]
pub enum TaskComplexity {
    Simple,    // Use cheap/fast model
    Medium,    // Use balanced model
    Complex,   // Use capable model
}

impl ModelSelector {
    pub fn select_model(
        &self,
        prompt: &str,
        settings: &PromptEnhancementSettings,
    ) -> String {
        // If user explicitly selected a model, use it
        if settings.preferred_model != "auto" {
            return settings.preferred_model.clone();
        }

        // Classify complexity
        let complexity = self.complexity_classifier.classify(prompt);

        match complexity {
            TaskComplexity::Simple => "gpt-4o-mini".into(),    // Cheapest
            TaskComplexity::Medium => "claude-3-sonnet".into(), // Balanced
            TaskComplexity::Complex => "claude-3-opus".into(),  // Most capable
        }
    }
}

impl ComplexityClassifier {
    pub fn classify(&self, prompt: &str) -> TaskComplexity {
        let word_count = prompt.split_whitespace().count();
        let has_code = prompt.contains("```") || prompt.contains("fn ") || prompt.contains("function");
        let has_multi_step = prompt.contains("1.") || prompt.contains("first") && prompt.contains("then");

        if word_count < 50 && !has_code && !has_multi_step {
            TaskComplexity::Simple
        } else if word_count > 200 || has_multi_step {
            TaskComplexity::Complex
        } else {
            TaskComplexity::Medium
        }
    }
}
```

### 9.4 Caching Strategy

```rust
#[derive(Debug, Clone)]
pub struct ResponseCache {
    store: Arc<RwLock<LruCache<String, CachedResponse>>>,
    ttl: Duration,
}

#[derive(Debug, Clone)]
pub struct CachedResponse {
    pub response: CompletionResponse,
    pub cached_at: Instant,
}

impl ResponseCache {
    pub fn new(capacity: usize, ttl: Duration) -> Self {
        Self {
            store: Arc::new(RwLock::new(LruCache::new(capacity))),
            ttl,
        }
    }

    pub fn get(&self, key: &str) -> Option<CompletionResponse> {
        let store = self.store.read().unwrap();

        if let Some(cached) = store.peek(key) {
            if cached.cached_at.elapsed() < self.ttl {
                return Some(cached.response.clone());
            }
        }

        None
    }

    pub fn put(&self, key: &str, response: CompletionResponse) {
        let mut store = self.store.write().unwrap();
        store.put(key.to_string(), CachedResponse {
            response,
            cached_at: Instant::now(),
        });
    }

    pub fn cache_key(prompt: &str, model: &str) -> String {
        // Hash prompt + model for cache key
        let mut hasher = Sha256::new();
        hasher.update(prompt.as_bytes());
        hasher.update(model.as_bytes());
        hex::encode(hasher.finalize())
    }
}

impl ModelGateway {
    pub async fn route_request_with_cache(
        &self,
        request: CompletionRequest,
        settings: &PromptEnhancementSettings,
    ) -> Result<CompletionResponse, LLMError> {
        let cache_key = ResponseCache::cache_key(
            &request.user_prompt,
            &settings.preferred_model,
        );

        // Check cache first
        if let Some(cached) = self.cache.get(&cache_key) {
            return Ok(cached);
        }

        // Make request
        let response = self.route_request(request, settings).await?;

        // Cache successful responses
        self.cache.put(&cache_key, response.clone());

        Ok(response)
    }
}
```

---

## 10. Local LLM Support (Ollama)

### 10.1 Ollama Integration

```rust
pub struct OllamaProvider {
    client: reqwest::Client,
    config: OllamaConfig,
}

impl OllamaProvider {
    pub fn new(config: OllamaConfig) -> Self {
        Self {
            client: reqwest::Client::builder()
                .timeout(Duration::from_millis(config.timeout_ms as u64))
                .build()
                .unwrap(),
            config,
        }
    }

    async fn generate(&self, request: &CompletionRequest) -> Result<OllamaResponse, LLMError> {
        let url = format!("{}/api/generate", self.config.endpoint);

        let body = serde_json::json!({
            "model": self.config.model,
            "prompt": format!("{}\n\nUser: {}", request.system_prompt, request.user_prompt),
            "stream": false,
            "options": {
                "temperature": request.temperature,
                "num_predict": request.max_tokens,
            }
        });

        let response = self.client
            .post(&url)
            .json(&body)
            .send()
            .await
            .map_err(|e| LLMError::Network(e.to_string()))?;

        if !response.status().is_success() {
            return Err(LLMError::Provider(
                format!("Ollama error: {}", response.status())
            ));
        }

        let ollama_response: OllamaResponse = response
            .json()
            .await
            .map_err(|e| LLMError::Parse(e.to_string()))?;

        Ok(ollama_response)
    }
}

#[async_trait]
impl LLMProvider for OllamaProvider {
    async fn complete(&self, request: CompletionRequest) -> Result<CompletionResponse, LLMError> {
        let start = Instant::now();
        let response = self.generate(&request).await?;
        let latency = start.elapsed().as_millis() as u64;

        Ok(CompletionResponse {
            content: response.response,
            input_tokens: response.prompt_eval_count.unwrap_or(0),
            output_tokens: response.eval_count.unwrap_or(0),
            model: self.config.model.clone(),
            latency_ms: latency,
            finish_reason: FinishReason::Stop,
        })
    }

    async fn health_check(&self) -> Result<ProviderHealth, LLMError> {
        let url = format!("{}/api/tags", self.config.endpoint);

        match self.client.get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                Ok(ProviderHealth::Healthy)
            }
            Ok(_) => Ok(ProviderHealth::Unhealthy("Bad status".into())),
            Err(e) => Ok(ProviderHealth::Unhealthy(e.to_string())),
        }
    }

    fn name(&self) -> &str {
        "ollama"
    }

    fn cost_per_1k_tokens(&self) -> (f64, f64) {
        (0.0, 0.0) // Local, no cost
    }
}
```

### 10.2 Supported Local Models

| Model | Use Case | Memory Required | Quality |
|-------|----------|-----------------|---------|
| llama3 (8B) | General purpose | ~8 GB | Good |
| llama3 (70B) | Complex tasks | ~48 GB | Excellent |
| codellama (7B) | Code generation | ~8 GB | Good for code |
| codellama (34B) | Code generation | ~20 GB | Better for code |
| mistral (7B) | General purpose | ~8 GB | Good |
| mixtral (8x7B) | Complex tasks | ~48 GB | Very good |

### 10.3 Performance Considerations

```rust
impl ModelGateway {
    pub async fn estimate_local_performance(
        &self,
        model: &str,
        prompt_tokens: u32,
    ) -> LocalPerformanceEstimate {
        // Rough estimates based on model size and typical hardware
        let (tokens_per_second, memory_gb) = match model {
            "llama3:8b" => (30.0, 8.0),
            "llama3:70b" => (5.0, 48.0),
            "codellama:7b" => (35.0, 8.0),
            "codellama:34b" => (10.0, 20.0),
            "mistral:7b" => (40.0, 8.0),
            "mixtral:8x7b" => (15.0, 48.0),
            _ => (20.0, 8.0),
        };

        let estimated_output_tokens = 500; // Typical enhancement
        let estimated_time_seconds = (prompt_tokens + estimated_output_tokens) as f64 / tokens_per_second;

        LocalPerformanceEstimate {
            model: model.to_string(),
            estimated_time_seconds,
            required_memory_gb: memory_gb,
            tokens_per_second,
        }
    }
}
```

### 10.4 Fallback Strategy

```rust
impl ModelGateway {
    pub async fn route_with_local_fallback(
        &self,
        request: CompletionRequest,
        settings: &PromptEnhancementSettings,
    ) -> Result<CompletionResponse, LLMError> {
        // Check if local model is preferred and available
        if settings.preferred_model.starts_with("ollama:") {
            if let Some(ollama) = &self.providers.get("ollama") {
                if ollama.health_check().await.is_ok() {
                    return ollama.complete(request).await;
                } else {
                    warn!("Ollama unavailable, falling back to cloud provider");
                }
            }
        }

        // Fall back to cloud providers
        self.route_request(request, settings).await
    }
}
```

---

## 11. Operational Playbooks

### 11.1 Incident Handling

#### High Error Rate from LLM Provider

**Symptom:** Error rate > 5% from a specific provider

**Steps:**
1. Check provider status page (status.openai.com, status.anthropic.com)
2. Review error logs for specific error codes
3. Enable fallback to secondary provider
4. If both providers down:
   - Check if Ollama is available locally
   - Enable response caching to reduce load
   - Notify users of degraded performance

**Runbook:**
```bash
# Check provider health
curl https://status.openai.com/api/v2/status.json
curl https://status.anthropic.com/api/v2/status.json

# Check local logs
tail -f ~/Library/Application\ Support/Vibe\ Kanban/logs/ai-service.log | grep ERROR

# Force fallback
# (via admin API or feature flag)
```

#### Quality Degradation

**Symptom:** Low user ratings, high edit rate, increased rejections

**Steps:**
1. Check recent prompt version changes
2. Compare metrics before/after changes
3. Rollback to previous prompt version if needed
4. Review flagged outputs for patterns
5. Adjust safety thresholds if over-filtering

**Metrics to Check:**
- Acceptance rate (should be > 60%)
- Edit rate (should be < 40%)
- Average score improvement (should be > 20)

### 11.2 Model Fallback Behavior

```
┌─────────────────────────────────────────────────────────────────┐
│                    Fallback Decision Tree                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Primary Provider Request                                       │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Success?        │──Yes──> Return Response                    │
│  └────────┬────────┘                                           │
│           │ No                                                  │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Retryable Error?│──Yes──> Retry (max 2x, exponential backoff)│
│  └────────┬────────┘                                           │
│           │ No                                                  │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Secondary       │──Success──> Return Response                │
│  │ Provider        │                                            │
│  └────────┬────────┘                                           │
│           │ Fail                                                │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Local Ollama    │──Success──> Return Response                │
│  │ Available?      │                                            │
│  └────────┬────────┘                                           │
│           │ Fail                                                │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │ Cached Response?│──Yes──> Return Cached (with warning)       │
│  └────────┬────────┘                                           │
│           │ No                                                  │
│           ▼                                                     │
│  Return User-Friendly Error                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11.3 Feature Flags

| Flag | Description | Default |
|------|-------------|---------|
| `ai.prompt_enhancement.enabled` | Master switch for all AI features | true |
| `ai.rag.enabled` | Enable codebase context extraction | true |
| `ai.git_context.enabled` | Enable git history context | false |
| `ai.auto_enhance.enabled` | Enable auto-enhancement on task create | false |
| `ai.caching.enabled` | Enable response caching | true |
| `ai.provider.openai.enabled` | Enable OpenAI provider | true |
| `ai.provider.anthropic.enabled` | Enable Anthropic provider | true |
| `ai.provider.ollama.enabled` | Enable Ollama provider | true |
| `ai.rate_limiting.enabled` | Enable rate limiting | true |

---

## 12. API Endpoints

### 12.1 Prompt Enhancement

```
POST /api/prompts/enhance
Authorization: Bearer {session_token}
Content-Type: application/json

Request:
{
  "prompt": "fix the login bug",
  "task_id": "uuid",              // optional, for context
  "include_codebase": true,       // optional, default from settings
  "include_git_history": false    // optional, default from settings
}

Response (200):
{
  "enhancement_id": "uuid",
  "original_prompt": "fix the login bug",
  "enhanced_prompt": "## Bug Fix: Login Authentication Issue\n\n### Problem...",
  "original_score": 35,
  "enhanced_score": 82,
  "techniques_applied": ["GoalExtraction", "RequirementStructuring", "SuccessCriteria"],
  "model_used": "claude-3-sonnet",
  "tokens_used": 450,
  "latency_ms": 2340
}

Response (429):
{
  "code": "PROMPT_003",
  "message": "Rate limit exceeded",
  "details": { "reset_at": "2026-01-13T15:00:00Z" }
}
```

### 12.2 Prompt Scoring

```
POST /api/prompts/score
Authorization: Bearer {session_token}
Content-Type: application/json

Request:
{
  "prompt": "fix the login bug"
}

Response (200):
{
  "total": 35,
  "clarity": 10,
  "specificity": 5,
  "context": 10,
  "actionability": 10,
  "suggestions": [
    {
      "component": "specificity",
      "suggestion": "Add specific file paths or function names",
      "priority": "high"
    },
    {
      "component": "context",
      "suggestion": "Describe the expected vs actual behavior",
      "priority": "medium"
    }
  ]
}
```

### 12.3 Template Management

```
GET /api/prompts/templates
Authorization: Bearer {session_token}

Response (200):
{
  "templates": [
    {
      "id": "uuid",
      "name": "Bug Fix",
      "description": "Template for bug fix tasks",
      "category": "bug-fix",
      "is_global": true,
      "usage_count": 42
    }
  ]
}

POST /api/prompts/templates
Authorization: Bearer {session_token}
Content-Type: application/json

Request:
{
  "name": "Custom Feature Template",
  "description": "Our team's feature template",
  "template_text": "## Feature: {{task_title}}\n\n...",
  "category": "feature"
}

POST /api/prompts/templates/{id}/render
Authorization: Bearer {session_token}
Content-Type: application/json

Request:
{
  "variables": {
    "task_title": "Add dark mode",
    "task_description": "Users want dark mode option"
  }
}

Response (200):
{
  "rendered": "## Feature: Add dark mode\n\n..."
}
```

### 12.4 Feedback Submission

```
POST /api/prompts/enhancements/{id}/feedback
Authorization: Bearer {session_token}
Content-Type: application/json

Request:
{
  "action": "accepted_edited",
  "edited_prompt": "The modified enhanced prompt...",
  "rating": 4,
  "comments": "Good structure, but needed minor adjustments"
}

Response (204 No Content)
```

### 12.5 Usage and Metrics

```
GET /api/prompts/usage
Authorization: Bearer {session_token}
Query: ?period=month

Response (200):
{
  "period": "2026-01",
  "total_enhancements": 156,
  "total_tokens": 78000,
  "estimated_cost_usd": 2.34,
  "by_model": {
    "claude-3-sonnet": {
      "requests": 120,
      "tokens": 60000,
      "cost_usd": 1.80
    },
    "gpt-4o-mini": {
      "requests": 36,
      "tokens": 18000,
      "cost_usd": 0.54
    }
  }
}
```

---

## 13. Acceptance Checklist

Before marking this spec complete:

- [x] All AI features documented with I/O, latency, quality targets
- [x] Model gateway and provider adapters specified
- [x] Prompt management and versioning strategy defined
- [x] Codebase and git context extraction (RAG-like) documented
- [x] Safety guardrails for PII, prompt injection, content policy
- [x] Evaluation strategy with A/B testing and feedback collection
- [x] Cost controls: caching, rate limits, token tracking
- [x] Operational playbooks for incidents
- [x] Local LLM (Ollama) support documented
- [x] API endpoints defined

---

## 14. Open Questions

1. **Embedding-based RAG:** Should we implement vector search for larger codebases, or is file tree + key files sufficient for v1?

2. **Prompt Version History:** Should we track all prompt versions for a task, or only the latest enhancement?

3. **Team-wide Learning:** Should successful enhancements from one user inform suggestions for others in the same workspace?

4. **Offline Mode:** How should prompt enhancement degrade when no LLM is available? (Suggest templates only?)

5. **Multi-language Support:** Should prompts be enhanced in the user's language, or always in English?

---

*This document is the source of truth for AI services in Vibe Kanban Desktop. Changes should be reviewed and approved before implementation.*
