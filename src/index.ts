import {
    Plugin,
    showMessage,
    confirm,
    Dialog,
    Menu,
    openTab,
    adaptHotkey,
    getFrontend,
    getBackend,
    Setting,
    fetchPost,
    Protyle,
    openWindow,
    IOperation,
    Constants,
    openMobileFileById,
    lockScreen,
    ICard,
    ICardData,
    Custom, exitSiYuan, getModelByDockType, getAllEditor, Files, platformUtils, openSetting, openAttributePanel
} from "siyuan";
import "./index.scss";
import {IMenuItem} from "siyuan/types";

// 修改存储名称和类型常量
const STORAGE_NAME = "task-manager-config";
const TAB_TYPE = "task_manager_tab";
const DOCK_TYPE = "task_manager_dock";

// 定义任务状态类型
enum TaskStatus {
    TODO = "TODO",
    NOW = "NOW",
    LATER = "LATER",
    DONE = "DONE"
}

// 定义任务优先级
enum TaskPriority {
    HIGH = "HIGH",
    MEDIUM = "MEDIUM",
    LOW = "LOW"
}

// 定义任务属性
interface TaskAttributes {
    status: TaskStatus;
    priority?: TaskPriority;
    plannedTime?: string;
    dueTime?: string;
}

export default class TaskManagerPlugin extends Plugin {

    private custom: () => Custom;
    private isMobile: boolean;
    private blockIconEventBindThis = this.blockIconEvent.bind(this);
    private taskStatusCycleBindThis = this.taskStatusCycle.bind(this);
    private loadedProtyleStaticBindThis = this.addTaskRefCounters.bind(this);

    updateProtyleToolbar(toolbar: Array<string | IMenuItem>) {
        toolbar.push("|");
        toolbar.push({
            name: "task-status-cycle",
            icon: "iconCheck",
            hotkey: "⌃⏎",
            tipPosition: "n",
            tip: this.i18n.cycleTaskStatus || "切换任务状态",
            click: (protyle: Protyle) => {
                this.taskStatusCycle();
            }
        });
        return toolbar;
    }

    onload() {
        this.data[STORAGE_NAME] = {
            taskDefaultPriority: "MEDIUM",
            showTaskAttributes: true
        };

        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";
        
        // 添加任务状态图标
        this.addIcons(`<symbol id="iconTaskNow" viewBox="0 0 32 32">
            <path d="M16 3.594c-6.844 0-12.406 5.562-12.406 12.406 0 6.844 5.562 12.406 12.406 12.406 6.844 0 12.406-5.562 12.406-12.406 0-6.844-5.562-12.406-12.406-12.406zM16 5.375c5.875 0 10.625 4.75 10.625 10.625 0 5.875-4.75 10.625-10.625 10.625-5.875 0-10.625-4.75-10.625-10.625 0-5.875 4.75-10.625 10.625-10.625zM14.344 9.375v8.656h8.656v-1.781h-6.875v-6.875z"></path>
        </symbol>
        <symbol id="iconTaskLater" viewBox="0 0 32 32">
            <path d="M16 3.594c-6.844 0-12.406 5.562-12.406 12.406 0 6.844 5.562 12.406 12.406 12.406 6.844 0 12.406-5.562 12.406-12.406 0-6.844-5.562-12.406-12.406-12.406zM16 5.375c5.875 0 10.625 4.75 10.625 10.625 0 5.875-4.75 10.625-10.625 10.625-5.875 0-10.625-4.75-10.625-10.625 0-5.875 4.75-10.625 10.625-10.625zM16 9.375c-0.5 0-0.875 0.375-0.875 0.875v5.75h-5.75c-0.5 0-0.875 0.375-0.875 0.875s0.375 0.875 0.875 0.875h6.625c0.5 0 0.875-0.375 0.875-0.875v-6.625c0-0.5-0.375-0.875-0.875-0.875z"></path>
        </symbol>
        <symbol id="iconTaskDone" viewBox="0 0 32 32">
            <path d="M16 3.594c-6.844 0-12.406 5.562-12.406 12.406 0 6.844 5.562 12.406 12.406 12.406 6.844 0 12.406-5.562 12.406-12.406 0-6.844-5.562-12.406-12.406-12.406zM16 5.375c5.875 0 10.625 4.75 10.625 10.625 0 5.875-4.75 10.625-10.625 10.625-5.875 0-10.625-4.75-10.625-10.625 0-5.875 4.75-10.625 10.625-10.625zM21.719 11.25l-7.438 7.438-4-4-1.281 1.281 5.281 5.281 8.719-8.719z"></path>
        </symbol>
        <symbol id="iconCheck" viewBox="0 0 32 32">
            <path d="M28 6.667l-16 16-8-8 2.667-2.667 5.333 5.333 13.333-13.333z"></path>
        </symbol>`);

        // 添加顶部栏图标
        const topBarElement = this.addTopBar({
            icon: "iconCheck",
            title: this.i18n.taskManager || "任务管理器",
            position: "right",
            callback: () => {
                if (this.isMobile) {
                    this.addTaskMenu();
                } else {
                    let rect = topBarElement.getBoundingClientRect();
                    if (rect.width === 0) {
                        rect = document.querySelector("#barMore").getBoundingClientRect();
                    }
                    if (rect.width === 0) {
                        rect = document.querySelector("#barPlugins").getBoundingClientRect();
                    }
                    this.addTaskMenu(rect);
                }
            }
        });

        // 添加任务状态切换命令
        this.addCommand({
            langKey: "cycleTaskStatus",
            hotkey: "⌃⏎",
            callback: () => {
                this.taskStatusCycle();
            },
        });

        // 添加任务面板命令
        this.addCommand({
            langKey: "openTaskPanel",
            hotkey: "⌥⌘T",
            callback: () => {
                this.openTaskPanel();
            },
        });

        // 监听文档加载事件，用于添加任务引用计数
        this.eventBus.on("loaded-protyle-static", this.loadedProtyleStaticBindThis);
        
        // 监听块图标点击事件
        this.eventBus.on("click-blockicon", this.blockIconEventBindThis);

        // 添加任务管理面板
        this.addDock({
            config: {
                position: "RightBottom",
                size: {width: 300, height: 0},
                icon: "iconCheck",
                title: this.i18n.taskManager || "任务管理器",
                hotkey: "⌥⌘T",
            },
            data: {
                tasks: []
            },
            type: DOCK_TYPE,
            resize() {
                console.log(DOCK_TYPE + " resize");
            },
            update() {
                console.log(DOCK_TYPE + " update");
            },
            init: (dock) => {
                this.initTaskDock(dock);
            },
            destroy() {
                console.log("destroy dock:", DOCK_TYPE);
            }
        });

        // 设置面板
        const showAttributesElement = document.createElement("input");
        showAttributesElement.type = "checkbox";
        this.setting = new Setting({
            confirmCallback: () => {
                this.saveData(STORAGE_NAME, {
                    taskDefaultPriority: this.data[STORAGE_NAME].taskDefaultPriority,
                    showTaskAttributes: showAttributesElement.checked
                });
            }
        });
        
        this.setting.addItem({
            title: this.i18n.showTaskAttributes || "显示任务属性",
            description: this.i18n.showTaskAttributesDesc || "在任务块下方显示计划时间和截止时间",
            createActionElement: () => {
                showAttributesElement.className = "b3-switch fn__flex-center";
                showAttributesElement.checked = this.data[STORAGE_NAME].showTaskAttributes !== false;
                return showAttributesElement;
            },
        });

        console.log(this.i18n.helloPlugin || "任务管理器插件已加载");
    }

    onLayoutReady() {
        this.loadData(STORAGE_NAME);
        // 初始化所有已打开文档中的任务
        this.initAllTasks();
    }

    onunload() {
        // 移除事件监听
        this.eventBus.off("loaded-protyle-static", this.loadedProtyleStaticBindThis);
        this.eventBus.off("click-blockicon", this.blockIconEventBindThis);
        console.log(this.i18n.byePlugin || "任务管理器插件已卸载");
    }

    // 初始化所有任务
    private async initAllTasks() {
        const editors = getAllEditor();
        for (const editor of editors) {
            const protyle = editor.protyle;
            if (!protyle) continue;
            
            // 查找所有任务块
            const taskBlocks = protyle.element.querySelectorAll('[data-type="i"] .protyle-action--task');
            
            for (const taskBlock of taskBlocks) {
                const blockElement = taskBlock.closest("[data-node-id]");
                if (!blockElement) continue;
                
                const blockId = blockElement.getAttribute("data-node-id");
                if (!blockId) continue;
                
                // 获取引用计数
                const refCount = await this.getBlockRefCount(blockId);
                
                // 添加引用计数显示
                this.addRefCountDisplay(blockElement, blockId, refCount);
                
                // 更新任务属性显示
                this.updateTaskAttributesDisplay(blockElement, blockId);
            }
        }
    }

    // 初始化任务面板
    private async initTaskDock(dock: any) {
        if (this.isMobile) {
            dock.element.innerHTML = `<div class="toolbar toolbar--border toolbar--dark">
    <svg class="toolbar__icon"><use xlink:href="#iconCheck"></use></svg>
        <div class="toolbar__text">${this.i18n.taskManager || "任务管理器"}</div>
    </div>
    <div class="fn__flex-1 task-manager-dock">
        <div class="task-manager-dock__loading">${this.i18n.loading || "加载中..."}</div>
    </div>
</div>`;
        } else {
            dock.element.innerHTML = `<div class="fn__flex-1 fn__flex-column">
    <div class="block__icons">
        <div class="block__logo">
            <svg class="block__logoicon"><use xlink:href="#iconCheck"></use></svg>${this.i18n.taskManager || "任务管理器"}
        </div>
        <span class="fn__flex-1 fn__space"></span>
        <span data-type="refresh" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="${this.i18n.refresh || "刷新"}"><svg><use xlink:href="#iconRefresh"></use></svg></span>
        <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="Min ${adaptHotkey("⌘W")}"><svg><use xlink:href="#iconMin"></use></svg></span>
    </div>
    <div class="fn__flex-1 task-manager-dock">
        <div class="task-manager-dock__loading">${this.i18n.loading || "加载中..."}</div>
    </div>
</div>`;
        }
        
        // 添加刷新按钮事件
        const refreshButton = dock.element.querySelector('[data-type="refresh"]');
        if (refreshButton) {
            refreshButton.addEventListener("click", () => {
                this.refreshTaskDock(dock);
            });
        }
        
        // 初始加载任务
        this.refreshTaskDock(dock);
    }

    // 刷新任务面板
    private async refreshTaskDock(dock: any) {
        const dockContent = dock.element.querySelector(".task-manager-dock");
        if (!dockContent) return;
        
        dockContent.innerHTML = `<div class="task-manager-dock__loading">${this.i18n.loading || "加载中..."}</div>`;
        
        try {
            // 获取所有任务
            const tasks = await this.getAllTasks();
            
            if (tasks.length === 0) {
                dockContent.innerHTML = `<div class="task-manager-dock__empty">${this.i18n.noTasks || "没有任务"}</div>`;
                return;
            }
            
            // 按状态分组
            const tasksByStatus = {
                [TaskStatus.NOW]: [],
                [TaskStatus.LATER]: [],
                [TaskStatus.TODO]: [],
                [TaskStatus.DONE]: []
            };
            
            tasks.forEach(task => {
                const status = task.attrs["custom-task-status"] || TaskStatus.TODO;
                if (!tasksByStatus[status]) {
                    tasksByStatus[status] = [];
                }
                tasksByStatus[status].push(task);
            });
            
            // 构建HTML
            let html = `<div class="task-manager-dock__content">`;
            
            // NOW 任务
            if (tasksByStatus[TaskStatus.NOW].length > 0) {
                html += this.buildTaskSection(TaskStatus.NOW, tasksByStatus[TaskStatus.NOW]);
            }
            
            // LATER 任务
            if (tasksByStatus[TaskStatus.LATER].length > 0) {
                html += this.buildTaskSection(TaskStatus.LATER, tasksByStatus[TaskStatus.LATER]);
            }
            
            // TODO 任务
            if (tasksByStatus[TaskStatus.TODO].length > 0) {
                html += this.buildTaskSection(TaskStatus.TODO, tasksByStatus[TaskStatus.TODO]);
            }
            
            // DONE 任务
            if (tasksByStatus[TaskStatus.DONE].length > 0) {
                html += this.buildTaskSection(TaskStatus.DONE, tasksByStatus[TaskStatus.DONE]);
            }
            
            html += `</div>`;
            
            dockContent.innerHTML = html;
            
            // 添加任务点击事件
            const taskItems = dockContent.querySelectorAll(".task-manager-dock__task");
            taskItems.forEach((item: Element) => {
                item.addEventListener("click", () => {
                    const id = item.getAttribute("data-id");
                    if (id) {
                        // 打开任务所在文档
                        openTab({
                            app: this.app,
                            doc: {
                                id: id
                            }
                        });
                    }
                });
            });
        } catch (error) {
            console.error("刷新任务面板失败:", error);
            dockContent.innerHTML = `<div class="task-manager-dock__error">${this.i18n.loadError || "加载失败"}</div>`;
        }
    }

    // 构建任务分组HTML
    private buildTaskSection(status: TaskStatus, tasks: any[]): string {
        let statusText = status;
        let statusClass = status.toLowerCase();
        
        let html = `<div class="task-manager-dock__section task-manager-dock__section--${statusClass}">
            <div class="task-manager-dock__section-title">${statusText} (${tasks.length})</div>
            <div class="task-manager-dock__tasks">`;
        
        tasks.forEach(task => {
            const priority = task.attrs["custom-task-priority"] || "";
            const priorityClass = priority ? `task-priority-${priority.toLowerCase()}` : "";
            
            html += `<div class="task-manager-dock__task ${priorityClass}" data-id="${task.id}">
                <div class="task-manager-dock__task-content">${task.content}</div>`;
            
            // 添加计划时间和截止时间
            const plannedTime = task.attrs["custom-planned-time"];
            const dueTime = task.attrs["custom-due-time"];
            
            if (plannedTime || dueTime) {
                html += `<div class="task-manager-dock__task-times">`;
                
                if (plannedTime) {
                    html += `<div class="task-manager-dock__task-planned">${this.i18n.plannedTime || "计划时间"}: ${this.formatDateTime(plannedTime)}</div>`;
                }
                
                if (dueTime) {
                    html += `<div class="task-manager-dock__task-due">${this.i18n.dueTime || "截止时间"}: ${this.formatDateTime(dueTime)}</div>`;
                }
                
                html += `</div>`;
            }
            
            html += `</div>`;
        });
        
        html += `</div></div>`;
        
        return html;
    }

    // 获取所有任务
    private async getAllTasks(): Promise<any[]> {
        try {
            // 使用正确的SQL查询接口获取所有任务块
            const response = await fetchPost("/api/query/sql", {
                stmt: "SELECT * FROM blocks WHERE type='i' AND subType='t'"
            });
            
            if (response.code === 0 && response.data) {
                const tasks = [];
                
                for (const block of response.data) {
                    // 获取块属性
                    const attrs = await this.getBlockAttrs(block.id);
                    block.attrs = attrs;
                    tasks.push(block);
                }
                
                return tasks;
            }
            
            return [];
        } catch (error) {
            console.error("获取所有任务失败:", error);
            return [];
        }
    }

    // 打开任务面板
    private openTaskPanel() {
        try {
            const taskDock = getModelByDockType(DOCK_TYPE);
            if (taskDock) {
                // 如果已经打开，刷新它
                this.refreshTaskDock(taskDock);
            } else {
                // 使用插件API的showDock方法
                try {
                    // 尝试使用全局API
                    const globalSiyuan = (window as any).siyuan;
                    if (globalSiyuan && globalSiyuan.layout && typeof globalSiyuan.layout.showDock === 'function') {
                        globalSiyuan.layout.showDock(DOCK_TYPE);
                    } else {
                        // 回退到使用事件触发方式
                        this.eventBus.emit("open-dock", {type: DOCK_TYPE});
                        
                        // 等待一段时间后尝试刷新
                        setTimeout(() => {
                            try {
                                const newTaskDock = getModelByDockType(DOCK_TYPE);
                                if (newTaskDock) {
                                    this.refreshTaskDock(newTaskDock);
                                }
                            } catch (error) {
                                console.error("延迟获取面板失败:", error);
                            }
                        }, 300);
                    }
                } catch (e) {
                    console.error("打开面板失败:", e);
                    showMessage(this.i18n.errorOpeningPanel || "打开任务面板失败");
                }
            }
        } catch (error) {
            console.error("打开任务面板时出错:", error);
            showMessage(this.i18n.errorOpeningPanel || "打开任务面板失败");
        }
    }

    // 添加任务菜单
    private addTaskMenu(rect?: DOMRect) {
        const menu = new Menu("taskManagerMenu");
        
        menu.addItem({
            icon: "iconCheck",
            label: this.i18n.openTaskPanel || "打开任务面板",
            click: () => {
                this.openTaskPanel();
            }
        });
        
        menu.addItem({
            icon: "iconRefresh",
            label: this.i18n.refreshTasks || "刷新任务",
            click: () => {
                // Add error handling to prevent the TypeError
                try {
                    const taskDock = getModelByDockType(DOCK_TYPE);
                    if (taskDock) {
                        this.refreshTaskDock(taskDock);
                    } else {
                        // If dock isn't found, first open it then refresh
                        this.openTaskPanel();
                        // Wait a bit for the dock to initialize
                        setTimeout(() => {
                            try {
                                const newTaskDock = getModelByDockType(DOCK_TYPE);
                                if (newTaskDock) {
                                    this.refreshTaskDock(newTaskDock);
                                }
                            } catch (error) {
                                console.error("Error getting dock after delay:", error);
                            }
                        }, 300);
                    }
                } catch (error) {
                    console.error("Error refreshing task panel:", error);
                    // Fallback to just opening the panel
                    this.openTaskPanel();
                }
            }
        });
        
        menu.addSeparator();
        
        menu.addItem({
            icon: "iconHelp",
            label: this.i18n.help || "帮助",
            click: () => {
                this.showHelpDialog();
            }
        });
        
        // Remove duplicate code and only keep this one instance
        if (this.isMobile) {
            menu.fullscreen();
        } else if (rect) {
            menu.open({
                x: rect.right,
                y: rect.bottom,
                isLeft: true,
            });
        } else {
            // Fallback position if rect is not provided
            menu.open({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                isLeft: true,
            });
        }
    }

    // 显示帮助对话框
    private showHelpDialog() {
        const dialog = new Dialog({
            title: this.i18n.taskManagerHelp || "任务管理器帮助",
            content: `<div class="b3-dialog__content">
                <div class="b3-typography">
                    <h3>${this.i18n.usage || "使用方法"}</h3>
                    <ul>
                        <li>${this.i18n.helpCycleStatus || "按下 Ctrl+Enter 可以循环切换任务状态：TODO → NOW → LATER → DONE → TODO"}</li>
                        <li>${this.i18n.helpSetAttributes || "右键点击任务块图标，可以设置任务状态、优先级、计划时间和截止时间"}</li>
                        <li>${this.i18n.helpRefCount || "任务块右侧会显示引用计数，点击可以查看所有引用"}</li>
                        <li>${this.i18n.helpTaskPanel || "通过顶部栏图标或快捷键 Alt+Cmd+T 可以打开任务面板"}</li>
                    </ul>
                </div>
            </div>`,
            width: this.isMobile ? "92vw" : "520px",
        });
    }

    // 任务状态循环切换方法
    private async taskStatusCycle() {
        const editor = this.getEditor();
        if (!editor) return;
        
        const protyle = editor.protyle;
        const range = getSelection();
        if (!range) return;
        
        // 获取当前选中的块
        const blockElement = range.commonAncestorContainer.closest("[data-node-id]");
        if (!blockElement) return;
        
        const blockId = blockElement.getAttribute("data-node-id");
        if (!blockId) return;
        
        // 检查是否为任务块
        const isTaskBlock = blockElement.querySelector('.protyle-action--task');
        if (!isTaskBlock) {
            showMessage(this.i18n.notTaskBlock || "当前块不是任务块");
            return;
        }
        
        // 获取块属性
        const blockAttrs = await this.getBlockAttrs(blockId);
        
        // 确定当前任务状态
        let currentStatus = blockAttrs["custom-task-status"] || TaskStatus.TODO;
        
        // 循环切换状态
        let newStatus;
        switch (currentStatus) {
            case TaskStatus.TODO:
                newStatus = TaskStatus.NOW;
                break;
            case TaskStatus.NOW:
                newStatus = TaskStatus.LATER;
                break;
            case TaskStatus.LATER:
                newStatus = TaskStatus.DONE;
                break;
            case TaskStatus.DONE:
                newStatus = TaskStatus.TODO;
                break;
            default:
                newStatus = TaskStatus.NOW;
        }
        
        // 更新块属性
        await this.setBlockAttrs(blockId, {"custom-task-status": newStatus});
        
        // 更新块内容显示
        this.updateTaskBlockDisplay(blockElement, newStatus);
        
        showMessage(`${this.i18n.taskStatusUpdated || "任务状态已更新为"}: ${newStatus}`);
    }
    
    // 获取块属性
    private async getBlockAttrs(blockId: string) {
        try {
            const response = await fetchPost("/api/attr/getBlockAttrs", {
                id: blockId
            });
            return response.data;
        } catch (error) {
            console.error("获取块属性失败:", error);
            return {};
        }
    }
    
    // 设置块属性
    private async setBlockAttrs(blockId: string, attrs: Record<string, string>) {
        try {
            await fetchPost("/api/attr/setBlockAttrs", {
                id: blockId,
                attrs: attrs
            });
            return true;
        } catch (error) {
            console.error("设置块属性失败:", error);
            return false;
        }
    }
    
    // 更新任务块显示
    private updateTaskBlockDisplay(blockElement: Element, status: TaskStatus) {
        // 移除旧的状态标记
        blockElement.classList.remove("task-status-todo", "task-status-now", "task-status-later", "task-status-done");
        
        // 添加新的状态标记
        blockElement.classList.add(`task-status-${status.toLowerCase()}`);
        
        // 更新任务图标
        let iconElement = blockElement.querySelector(".task-status-icon");
        if (!iconElement) {
            iconElement = document.createElement("span");
            iconElement.className = "task-status-icon";
            const contentElement = blockElement.querySelector('[contenteditable="true"]');
            if (contentElement) {
                contentElement.parentElement.insertBefore(iconElement, contentElement);
            }
        }
        
        // 添加新图标
        switch (status) {
            case TaskStatus.NOW:
                iconElement.innerHTML = '<svg><use xlink:href="#iconTaskNow"></use></svg>';
                break;
            case TaskStatus.LATER:
                iconElement.innerHTML = '<svg><use xlink:href="#iconTaskLater"></use></svg>';
                break;
            case TaskStatus.DONE:
                iconElement.innerHTML = '<svg><use xlink:href="#iconTaskDone"></use></svg>';
                break;
            default:
                // TODO 状态使用默认图标
                iconElement.innerHTML = '';
                break;
        }
    }

        // 在blockIconEvent方法中添加任务属性设置菜单
    private blockIconEvent({detail}: any) {
        // 检查是否为任务块
        const isTaskBlock = detail.blockElements.some((item: HTMLElement) => {
            return item.getAttribute("data-type") === "i" && 
                   item.querySelector(".protyle-action--task");
        });
        
        if (isTaskBlock) {
            detail.menu.addItem({
                id: "taskManager_setStatus",
                icon: "iconSelect",
                label: this.i18n.setTaskStatus || "设置任务状态",
                submenu: [
                    {
                        id: "taskManager_setStatusTodo",
                        icon: "",
                        label: "TODO",
                        click: () => {
                            this.setTaskStatus(detail.blockElements, TaskStatus.TODO);
                        }
                    },
                    {
                        id: "taskManager_setStatusNow",
                        icon: "",
                        label: "NOW",
                        click: () => {
                            this.setTaskStatus(detail.blockElements, TaskStatus.NOW);
                        }
                    },
                    {
                        id: "taskManager_setStatusLater",
                        icon: "",
                        label: "LATER",
                        click: () => {
                            this.setTaskStatus(detail.blockElements, TaskStatus.LATER);
                        }
                    },
                    {
                        id: "taskManager_setStatusDone",
                        icon: "",
                        label: "DONE",
                        click: () => {
                            this.setTaskStatus(detail.blockElements, TaskStatus.DONE);
                        }
                    }
                ]
            });
            
            detail.menu.addItem({
                id: "taskManager_setPriority",
                icon: "iconUp",
                label: this.i18n.setTaskPriority || "设置任务优先级",
                submenu: [
                    {
                        id: "taskManager_setPriorityHigh",
                        icon: "",
                        label: "高",
                        click: () => {
                            this.setTaskPriority(detail.blockElements, TaskPriority.HIGH);
                        }
                    },
                    {
                        id: "taskManager_setPriorityMedium",
                        icon: "",
                        label: "中",
                        click: () => {
                            this.setTaskPriority(detail.blockElements, TaskPriority.MEDIUM);
                        }
                    },
                    {
                        id: "taskManager_setPriorityLow",
                        icon: "",
                        label: "低",
                        click: () => {
                            this.setTaskPriority(detail.blockElements, TaskPriority.LOW);
                        }
                    }
                ]
            });
            
            detail.menu.addItem({
                id: "taskManager_setTimes",
                icon: "iconCalendar",
                label: this.i18n.setTaskTimes || "设置任务时间",
                click: () => {
                    this.showTaskTimeDialog(detail.blockElements[0]);
                }
            });
        }
        
        // 保留原有的移除空格功能
        detail.menu.addItem({
            id: "pluginSample_removeSpace",
            iconHTML: "",
            label: this.i18n.removeSpace,
            click: () => {
                const doOperations: IOperation[] = [];
                detail.blockElements.forEach((item: HTMLElement) => {
                    const editElement = item.querySelector('[contenteditable="true"]');
                    if (editElement) {
                        editElement.textContent = editElement.textContent.replace(/ /g, "");
                        doOperations.push({
                            id: item.dataset.nodeId,
                            data: item.outerHTML,
                            action: "update"
                        });
                    }
                });
                detail.protyle.getInstance().transaction(doOperations);
            }
        });
    }
    
    // 设置任务状态
    private async setTaskStatus(blockElements: HTMLElement[], status: TaskStatus) {
        for (const blockElement of blockElements) {
            const blockId = blockElement.dataset.nodeId;
            if (!blockId) continue;
            
            await this.setBlockAttrs(blockId, {"custom-task-status": status});
            this.updateTaskBlockDisplay(blockElement, status);
        }
        
        showMessage(`已将 ${blockElements.length} 个任务状态设置为: ${status}`);
    }
    
    // 设置任务优先级
    private async setTaskPriority(blockElements: HTMLElement[], priority: TaskPriority) {
        for (const blockElement of blockElements) {
            const blockId = blockElement.dataset.nodeId;
            if (!blockId) continue;
            
            await this.setBlockAttrs(blockId, {"custom-task-priority": priority});
            
            // 更新优先级显示
            this.updateTaskPriorityDisplay(blockElement, priority);
        }
        
        showMessage(`已将 ${blockElements.length} 个任务优先级设置为: ${priority}`);
    }
    
    // 更新任务优先级显示
    private updateTaskPriorityDisplay(blockElement: HTMLElement, priority: TaskPriority) {
        // 移除旧的优先级标记
        blockElement.classList.remove("task-priority-high", "task-priority-medium", "task-priority-low");
        
        // 添加新的优先级标记
        blockElement.classList.add(`task-priority-${priority.toLowerCase()}`);
        
        // 更新优先级图标或标记
        let priorityElement = blockElement.querySelector(".task-priority-indicator");
        if (!priorityElement) {
            priorityElement = document.createElement("span");
            priorityElement.className = "task-priority-indicator";
            const contentElement = blockElement.querySelector('[contenteditable="true"]');
            if (contentElement) {
                contentElement.parentElement.insertBefore(priorityElement, contentElement);
            }
        }
        
        // 添加新图标
        switch (priority) {
            case TaskPriority.HIGH:
                priorityElement.textContent = "!!!";
                break;
            case TaskPriority.MEDIUM:
                priorityElement.textContent = "!!";
                break;
            case TaskPriority.LOW:
                priorityElement.textContent = "!";
                break;
        }
    }
    
    // 显示任务时间设置对话框
    private showTaskTimeDialog(blockElement: HTMLElement) {
        const blockId = blockElement.dataset.nodeId;
        if (!blockId) return;
        
        this.getBlockAttrs(blockId).then(attrs => {
            const plannedTime = attrs["custom-planned-time"] || "";
            const dueTime = attrs["custom-due-time"] || "";
            
            const dialog = new Dialog({
                title: this.i18n.setTaskTimes || "设置任务时间",
                content: `<div class="b3-dialog__content">
                    <div class="b3-form__item">
                        <label for="plannedTime">${this.i18n.plannedTime || "计划时间"}</label>
                        <input class="b3-text-field fn__flex-1" id="plannedTime" type="datetime-local" value="${plannedTime}">
                    </div>
                    <div class="b3-form__item">
                        <label for="dueTime">${this.i18n.dueTime || "截止时间"}</label>
                        <input class="b3-text-field fn__flex-1" id="dueTime" type="datetime-local" value="${dueTime}">
                    </div>
                </div>
                <div class="b3-dialog__action">
                    <button class="b3-button b3-button--cancel">${this.i18n.cancel || "取消"}</button>
                    <div class="fn__space"></div>
                    <button class="b3-button b3-button--text">${this.i18n.confirm || "确定"}</button>
                </div>`,
                width: this.isMobile ? "92vw" : "520px",
            });
            
            const btnsElement = dialog.element.querySelectorAll(".b3-button");
            btnsElement[0].addEventListener("click", () => {
                dialog.destroy();
            });
            
            btnsElement[1].addEventListener("click", () => {
                const plannedTimeInput = dialog.element.querySelector("#plannedTime") as HTMLInputElement;
                const dueTimeInput = dialog.element.querySelector("#dueTime") as HTMLInputElement;
                
                const newPlannedTime = plannedTimeInput.value;
                const newDueTime = dueTimeInput.value;
                
                // 设置任务时间属性
                this.setBlockAttrs(blockId, {
                    "custom-planned-time": newPlannedTime,
                    "custom-due-time": newDueTime
                }).then(() => {
                    // 更新任务时间显示
                    this.updateTaskTimeDisplay(blockElement, newPlannedTime, newDueTime);
                    showMessage(this.i18n.taskTimesUpdated || "任务时间已更新");
                });
                
                dialog.destroy();
            });
        });
    }
    
    // 更新任务时间显示
    private updateTaskTimeDisplay(blockElement: HTMLElement, plannedTime: string, dueTime: string) {
        // 查找或创建任务时间显示区域
        let timeDisplayElement = blockElement.querySelector(".task-time-display");
        if (!timeDisplayElement) {
            timeDisplayElement = document.createElement("div");
            timeDisplayElement.className = "task-time-display";
            blockElement.appendChild(timeDisplayElement);
        }
        
        // 清空现有内容
        timeDisplayElement.innerHTML = "";
        
        // 添加计划时间显示
        if (plannedTime) {
            const plannedElement = document.createElement("div");
            plannedElement.className = "task-planned-time";
            plannedElement.innerHTML = `<span class="task-time-label">${this.i18n.plannedTime || "计划时间"}:</span> ${this.formatDateTime(plannedTime)}`;
            timeDisplayElement.appendChild(plannedElement);
        }
        
        // 添加截止时间显示
        if (dueTime) {
            const dueElement = document.createElement("div");
            dueElement.className = "task-due-time";
            dueElement.innerHTML = `<span class="task-time-label">${this.i18n.dueTime || "截止时间"}:</span> ${this.formatDateTime(dueTime)}`;
            timeDisplayElement.appendChild(dueElement);
        }
    }
    
    // 格式化日期时间显示
    private formatDateTime(dateTimeString: string): string {
        if (!dateTimeString) return "";
        
        try {
            const date = new Date(dateTimeString);
            return date.toLocaleString();
        } catch (e) {
            return dateTimeString;
        }
    }
    
    // 添加任务引用计数器
    private async addTaskRefCounters(event: any) {
        const protyle = event.detail.protyle;
        if (!protyle) return;
        
        // 查找所有任务块
        const taskBlocks = protyle.element.querySelectorAll('[data-type="i"] .protyle-action--task');
        
        for (const taskBlock of taskBlocks) {
            const blockElement = taskBlock.closest("[data-node-id]");
            if (!blockElement) continue;
            
            const blockId = blockElement.getAttribute("data-node-id");
            if (!blockId) continue;
            
            // 获取引用计数
            const refCount = await this.getBlockRefCount(blockId);
            
            // 添加引用计数显示
            this.addRefCountDisplay(blockElement, blockId, refCount);
            
            // 更新任务属性显示
            this.updateTaskAttributesDisplay(blockElement, blockId);
        }
    }
    
    // 获取块引用计数
    private async getBlockRefCount(blockId: string): Promise<number> {
        try {
            const response = await fetchPost("/api/ref/getBacklink", {
                id: blockId
            });
            
            if (response.code === 0 && response.data) {
                // 计算引用数量
                let count = 0;
                if (response.data.backlinks) {
                    count += response.data.backlinks.length;
                }
                if (response.data.mentions) {
                    count += response.data.mentions.length;
                }
                return count;
            }
            
            return 0;
        } catch (error) {
            console.error("获取块引用计数失败:", error);
            return 0;
        }
    }
    
    // 添加引用计数显示
    private addRefCountDisplay(blockElement: Element, blockId: string, refCount: number) {
        // 查找或创建引用计数显示元素
        let refCountElement = blockElement.querySelector(".task-ref-count");
        if (!refCountElement) {
            refCountElement = document.createElement("span");
            refCountElement.className = "task-ref-count";
            blockElement.appendChild(refCountElement);
        }
        
        // 设置引用计数
        refCountElement.textContent = refCount > 0 ? `${refCount}` : "";
        
        // 如果有引用，添加点击事件
        if (refCount > 0) {
            refCountElement.classList.add("task-ref-count-clickable");
            refCountElement.addEventListener("click", (event) => {
                event.stopPropagation();
                this.showBlockReferences(blockId);
            });
        } else {
            refCountElement.classList.remove("task-ref-count-clickable");
            // 移除所有事件监听器
            const newElement = refCountElement.cloneNode(true);
            refCountElement.parentNode.replaceChild(newElement, refCountElement);
        }
    }
    
    // 显示块引用
    private async showBlockReferences(blockId: string) {
        try {
            // 打开引用面板
            openTab({
                app: this.app,
                custom: {
                    icon: "iconLink",
                    title: this.i18n.blockReferences || "块引用",
                    data: {
                        blockId: blockId
                    },
                    id: `task-manager-refs-${blockId}`
                }
            });
            
            // 获取引用数据
            const response = await fetchPost("/api/ref/getBacklink", {
                id: blockId
            });
            
            if (response.code === 0 && response.data) {
                // 在自定义面板中显示引用
                const customTab = document.querySelector(`#task-manager-refs-${blockId}`);
                if (customTab) {
                    let html = `<div class="fn__flex-column task-manager-refs">
                        <div class="b3-typography task-manager-refs__title">${this.i18n.blockReferences || "块引用"}</div>`;
                    
                    // 添加反向链接
                    if (response.data.backlinks && response.data.backlinks.length > 0) {
                        html += `<div class="task-manager-refs__section">
                            <div class="task-manager-refs__section-title">${this.i18n.backlinks || "反向链接"}</div>`;
                        
                        response.data.backlinks.forEach((link: any) => {
                            html += `<div class="task-manager-refs__item" data-id="${link.id}">
                                <div class="task-manager-refs__item-content">${link.content}</div>
                                <div class="task-manager-refs__item-path">${link.path}</div>
                            </div>`;
                        });
                        
                        html += `</div>`;
                    }
                    
                    // 添加提及
                    if (response.data.mentions && response.data.mentions.length > 0) {
                        html += `<div class="task-manager-refs__section">
                            <div class="task-manager-refs__section-title">${this.i18n.mentions || "提及"}</div>`;
                        
                        response.data.mentions.forEach((mention: any) => {
                            html += `<div class="task-manager-refs__item" data-id="${mention.id}">
                                <div class="task-manager-refs__item-content">${mention.content}</div>
                                <div class="task-manager-refs__item-path">${mention.path}</div>
                            </div>`;
                        });
                        
                        html += `</div>`;
                    }
                    
                    html += `</div>`;
                    
                    customTab.innerHTML = html;
                    
                    // 添加点击事件，点击引用项跳转到对应块
                    const refItems = customTab.querySelectorAll(".task-manager-refs__item");
                    refItems.forEach((item: Element) => {
                        item.addEventListener("click", () => {
                            const id = item.getAttribute("data-id");
                            if (id) {
                                // 打开引用的块
                                openTab({
                                    app: this.app,
                                    doc: {
                                        id: id
                                    }
                                });
                            }
                        });
                    });
                }
            }
        } catch (error) {
            console.error("显示块引用失败:", error);
            showMessage(this.i18n.failedToShowReferences || "无法显示引用");
        }
    }
    
    // 更新任务属性显示
    private async updateTaskAttributesDisplay(blockElement: Element, blockId: string) {
        // 获取任务属性
        const attrs = await this.getBlockAttrs(blockId);
        
        // 获取任务状态、优先级和时间
        const status = attrs["custom-task-status"] || TaskStatus.TODO;
        const priority = attrs["custom-task-priority"] || TaskPriority.MEDIUM;
        const plannedTime = attrs["custom-planned-time"] || "";
        const dueTime = attrs["custom-due-time"] || "";
        
        // 更新任务状态显示
        this.updateTaskBlockDisplay(blockElement, status as TaskStatus);
        
        // 更新任务优先级显示
        this.updateTaskPriorityDisplay(blockElement as HTMLElement, priority as TaskPriority);
        
        // 更新任务时间显示
        if (this.data[STORAGE_NAME].showTaskAttributes !== false) {
            this.updateTaskTimeDisplay(blockElement as HTMLElement, plannedTime, dueTime);
        }
    }
    
    // 获取当前编辑器
    private getEditor() {
        const editors = getAllEditor();
        if (editors.length === 0) {
            showMessage(this.i18n.openDocFirst || "请先打开文档");
            return null;
        }
        return editors[0];
    }
}