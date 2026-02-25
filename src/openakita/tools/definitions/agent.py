"""
Multi-agent tools — delegate_to_agent and create_agent.

Only injected when settings.multi_agent_enabled is True.
These tools allow the AI to delegate tasks to other agents
and create new temporary agent instances within a session.
"""

AGENT_TOOLS = [
    {
        "name": "delegate_to_agent",
        "category": "Agent",
        "description": (
            "Delegate a task to another specialized agent. "
            "When you need to: (1) Hand off work requiring expertise you lack, "
            "(2) Route a sub-task to a domain specialist, "
            "(3) Collaborate across agent roles."
        ),
        "detail": (
            "将任务委派给另一个专业 Agent。\n\n"
            "**适用场景**：\n"
            "- 当前任务需要另一个 Agent 的专长（如代码、数据分析、浏览器操作）\n"
            "- 拆分复杂任务到多个 Agent 协作完成\n"
            "- 需要特定技能集的 Agent 处理子任务\n\n"
            "**注意事项**：\n"
            "- 目标 Agent 必须已注册（预设或动态创建）\n"
            "- 委派深度上限为 5 层，防止无限递归\n"
            "- 结果会同步返回给当前 Agent"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "agent_id": {
                    "type": "string",
                    "description": "目标 Agent Profile ID（如 'code-assistant', 'data-analyst', 'browser-agent'）",
                },
                "message": {
                    "type": "string",
                    "description": "发送给目标 Agent 的任务描述",
                },
                "reason": {
                    "type": "string",
                    "description": "委派原因（可选，用于日志和追踪）",
                },
            },
            "required": ["agent_id", "message"],
        },
        "examples": [
            {
                "scenario": "将代码任务委派给代码助手",
                "params": {
                    "agent_id": "code-assistant",
                    "message": "请帮我重构 utils.py 中的日期处理函数",
                    "reason": "需要代码专长",
                },
                "expected": "代码助手的回复",
            },
        ],
    },
    {
        "name": "delegate_parallel",
        "category": "Agent",
        "description": (
            "Delegate tasks to multiple agents in parallel. "
            "Use when you need to assign independent tasks to different agents simultaneously."
        ),
        "detail": (
            "同时委派任务给多个 Agent 并行执行。\n\n"
            "**适用场景**：\n"
            "- 多个独立子任务可以同时执行（如同时搜索+分析）\n"
            "- 需要多个 Agent 同时调研不同方向\n\n"
            "**注意事项**：\n"
            "- 所有任务并行执行，结果一起返回\n"
            "- 各任务之间不能有依赖关系（有依赖请用 delegate_to_agent 串行委派）"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "tasks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "agent_id": {
                                "type": "string",
                                "description": "目标 Agent Profile ID",
                            },
                            "message": {
                                "type": "string",
                                "description": "发送给该 Agent 的任务描述",
                            },
                            "reason": {
                                "type": "string",
                                "description": "委派原因（可选）",
                            },
                        },
                        "required": ["agent_id", "message"],
                    },
                    "description": "要并行执行的任务列表",
                },
            },
            "required": ["tasks"],
        },
        "examples": [
            {
                "scenario": "同时让两个 Agent 调研不同项目",
                "params": {
                    "tasks": [
                        {"agent_id": "browser-agent", "message": "调研 OpenAkita 项目", "reason": "网络搜索"},
                        {"agent_id": "data-analyst", "message": "分析产品数据", "reason": "数据分析"},
                    ],
                },
                "expected": "两个 Agent 并行执行后合并返回结果",
            },
        ],
    },
    {
        "name": "create_agent",
        "category": "Agent",
        "description": (
            "Create a temporary specialized agent for this session. "
            "When you need to: (1) No existing agent profile fits the task, "
            "(2) Create a custom specialist on the fly, "
            "(3) Spawn a one-off helper with specific skills."
        ),
        "detail": (
            "为当前会话创建一个临时 Agent 实例。\n\n"
            "**适用场景**：\n"
            "- 现有 Agent 都不适合当前任务\n"
            "- 需要一个具有特定技能组合的临时专家\n"
            "- 快速原型化新的 Agent 角色\n\n"
            "**限制**：\n"
            "- 每个会话最多创建 3 个动态 Agent\n"
            "- 动态 Agent 不能再创建新 Agent\n"
            "- 最大存活时间 60 分钟"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Agent 名称",
                },
                "description": {
                    "type": "string",
                    "description": "Agent 功能描述",
                },
                "skills": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "要分配的技能 ID 列表（可选）",
                },
                "custom_prompt": {
                    "type": "string",
                    "description": "自定义系统提示词（可选）",
                },
            },
            "required": ["name", "description"],
        },
        "examples": [
            {
                "scenario": "创建一个 SQL 专家 Agent",
                "params": {
                    "name": "SQL Expert",
                    "description": "专门处理 SQL 查询优化和数据库设计",
                    "custom_prompt": "你是一个 SQL 优化专家，擅长查询性能调优。",
                },
                "expected": "✅ Agent created: dynamic_sql_expert_xxxx (SQL Expert)",
            },
        ],
    },
]
