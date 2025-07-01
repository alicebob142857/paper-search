
/**
 * 智能论文检索系统
 * 支持自动扫描数据文件和高级关键词搜索
 */

class PaperSearchSystem {
    constructor() {
        // 核心数据
        this.availableFiles = new Map(); // 存储可用的数据文件信息
        this.currentPapers = []; // 当前加载的论文数据
        this.searchResults = []; // 搜索结果
        this.keywords = new Set(); // 搜索关键词集合
        
        // 分页配置
        this.currentPage = 1;
        this.papersPerPage = 10;
        
        // DOM 元素引用
        this.initializeElements();
        
        // 初始化系统
        this.initialize();
    }
    
    /**
     * 初始化 DOM 元素引用
     */
    initializeElements() {
        this.elements = {
            conferenceSelect: document.getElementById('conferenceSelect'),
            yearSelect: document.getElementById('yearSelect'),
            loadDataBtn: document.getElementById('loadDataBtn'),
            keywordInput: document.getElementById('keywordInput'),
            addKeywordBtn: document.getElementById('addKeywordBtn'),
            searchBtn: document.getElementById('searchBtn'),
            clearKeywordsBtn: document.getElementById('clearKeywordsBtn'),
            keywordsDisplay: document.getElementById('keywordsDisplay'),
            statusDisplay: document.getElementById('statusDisplay'),
            resultsContainer: document.getElementById('resultsContainer'),
            paginationContainer: document.getElementById('paginationContainer'),
            loadingOverlay: document.getElementById('loadingOverlay')
        };
    }
    
    /**
     * 系统初始化
     */
    async initialize() {
        this.setupEventListeners();
        await this.scanDataFiles();
        this.updateKeywordsDisplay();
        this.updateStatus('系统初始化完成，请选择会议和年份');
    }
    
    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 会议选择变化事件
        this.elements.conferenceSelect.addEventListener('change', () => {
            this.onConferenceChange();
        });
        
        // 加载数据按钮
        this.elements.loadDataBtn.addEventListener('click', () => {
            this.loadPaperData();
        });
        
        // 关键词输入事件
        this.elements.keywordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addKeyword();
            }
        });
        
        // 添加关键词按钮
        this.elements.addKeywordBtn.addEventListener('click', () => {
            this.addKeyword();
        });
        
        // 搜索按钮
        this.elements.searchBtn.addEventListener('click', () => {
            this.performSearch();
        });
        
        // 清空关键词按钮
        this.elements.clearKeywordsBtn.addEventListener('click', () => {
            this.clearKeywords();
        });
    }
    
    /**
     * 扫描 data 文件夹中的可用文件
     */
    async scanDataFiles() {
        this.showLoading('扫描数据文件中...');
        
        // 预定义的会议列表（可以根据实际情况调整）
        const conferences = [
            'aaai', 'nips', 'icml', 'iclr', 'acl', 'emnlp', 'naacl', 
            'cvpr', 'iccv', 'eccv', 'sigir', 'www', 'kdd', 'ijcai'
        ];
        
        // 可能的年份范围
        const years = [];
        const currentYear = new Date().getFullYear();
        for (let year = 2015; year <= currentYear; year++) {
            years.push(year.toString());
        }
        
        // 检查每个会议和年份的组合
        for (const conference of conferences) {
            const conferenceFiles = [];
            
            for (const year of years) {
                const fileName = `${conference}${year}.json`;
                const filePath = `data/${conference}/${fileName}`;
                
                // 尝试检查文件是否存在
                if (await this.checkFileExists(filePath)) {
                    conferenceFiles.push({
                        year: year,
                        fileName: fileName,
                        filePath: filePath
                    });
                }
            }
            
            if (conferenceFiles.length > 0) {
                this.availableFiles.set(conference.toUpperCase(), conferenceFiles);
            }
        }
        
        this.hideLoading();
        this.populateConferenceSelect();
        
        if (this.availableFiles.size === 0) {
            this.updateStatus('未找到任何数据文件，请确保 data 文件夹中有正确的 JSON 文件', 'error');
        } else {
            this.updateStatus(`找到 ${this.availableFiles.size} 个会议的数据，请选择具体的会议和年份`, 'success');
        }
    }
    
    /**
     * 检查文件是否存在
     */
    async checkFileExists(filePath) {
        try {
            const response = await fetch(filePath, { method: 'HEAD' });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * 填充会议选择下拉框
     */
    populateConferenceSelect() {
        this.elements.conferenceSelect.innerHTML = '<option value="">请选择会议...</option>';
        
        // 按字母顺序排序会议名称
        const sortedConferences = Array.from(this.availableFiles.keys()).sort();
        
        sortedConferences.forEach(conference => {
            const option = document.createElement('option');
            option.value = conference;
            option.textContent = conference;
            this.elements.conferenceSelect.appendChild(option);
        });
    }
    
    /**
     * 会议选择变化处理
     */
    onConferenceChange() {
        const selectedConference = this.elements.conferenceSelect.value;
        this.elements.yearSelect.innerHTML = '<option value="">请选择年份...</option>';
        
        if (selectedConference && this.availableFiles.has(selectedConference)) {
            const conferenceFiles = this.availableFiles.get(selectedConference);
            
            // 按年份降序排序
            conferenceFiles.sort((a, b) => parseInt(b.year) - parseInt(a.year));
            
            conferenceFiles.forEach(file => {
                const option = document.createElement('option');
                option.value = file.year;
                option.textContent = file.year;
                option.dataset.filePath = file.filePath;
                this.elements.yearSelect.appendChild(option);
            });
            
            this.updateStatus(`${selectedConference} 会议有 ${conferenceFiles.length} 个年份的数据可用`);
        }
    }
    
    /**
     * 加载论文数据
     */
    async loadPaperData() {
        const selectedConference = this.elements.conferenceSelect.value;
        const selectedYear = this.elements.yearSelect.value;
        
        if (!selectedConference || !selectedYear) {
            this.updateStatus('请先选择会议和年份', 'warning');
            return;
        }
        
        const selectedOption = this.elements.yearSelect.selectedOptions[0];
        const filePath = selectedOption.dataset.filePath;
        
        this.showLoading('加载论文数据中...');
        
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.currentPapers = this.processPaperData(data, selectedConference, selectedYear);
            
            this.hideLoading();
            this.updateStatus(`成功加载 ${this.currentPapers.length} 篇 ${selectedConference} ${selectedYear} 的论文`, 'success');
            
            // 如果有关键词，自动执行搜索
            if (this.keywords.size > 0) {
                this.performSearch();
            } else {
                this.displayAllPapers();
            }
            
        } catch (error) {
            this.hideLoading();
            console.error('加载数据失败:', error);
            this.updateStatus(`加载数据失败: ${error.message}`, 'error');
        }
    }
    
    /**
     * 处理论文数据，标准化格式
     */
    processPaperData(rawData, conference, year) {
        let papers = [];
        
        // 处理不同的数据格式
        if (Array.isArray(rawData)) {
            papers = rawData;
        } else if (rawData.papers && Array.isArray(rawData.papers)) {
            papers = rawData.papers;
        } else if (typeof rawData === 'object') {
            // 尝试从对象中提取论文数组
            const possibleKeys = ['papers', 'data', 'results', 'items'];
            for (const key of possibleKeys) {
                if (rawData[key] && Array.isArray(rawData[key])) {
                    papers = rawData[key];
                    break;
                }
            }
        }
        
        // 标准化每篇论文的数据格式
        return papers.map((paper, index) => ({
            id: paper.id || `${conference}-${year}-${index}`,
            title: paper.title || paper.Title || 'Untitled',
            authors: paper.authors || paper.Authors || paper.author || 'Unknown Authors',
            abstract: paper.abstract || paper.Abstract || paper.summary || '',
            conference: conference,
            year: year,
            url: paper.url || paper.link || paper.pdf_url || '',
            pdf_url: paper.pdf_url || paper.pdf || paper.url || '',
            keywords: paper.keywords || paper.Keywords || [],
            venue: paper.venue || `${conference} ${year}`,
            // 添加用于搜索的组合文本
            searchText: this.createSearchText(paper)
        }));
    }
    
    /**
     * 创建用于搜索的组合文本
     */
    createSearchText(paper) {
        const title = paper.title || paper.Title || '';
        const authors = paper.authors || paper.Authors || paper.author || '';
        const abstract = paper.abstract || paper.Abstract || paper.summary || '';
        const keywords = Array.isArray(paper.keywords) ? paper.keywords.join(' ') : (paper.keywords || '');
        
        return `${title} ${authors} ${abstract} ${keywords}`.toLowerCase();
    }
    
    /**
     * 添加关键词
     */
    addKeyword() {
        const keyword = this.elements.keywordInput.value.trim();
        
        if (!keyword) {
            return;
        }
        
        if (this.keywords.has(keyword.toLowerCase())) {
            this.updateStatus(`关键词 "${keyword}" 已存在`, 'warning');
            return;
        }
        
        this.keywords.add(keyword.toLowerCase());
        this.elements.keywordInput.value = '';
        this.updateKeywordsDisplay();
        
        // 如果已经加载了数据，自动执行搜索
        if (this.currentPapers.length > 0) {
            this.performSearch();
        }
    }
    
    /**
     * 移除关键词
     */
    removeKeyword(keyword) {
        this.keywords.delete(keyword);
        this.updateKeywordsDisplay();
        
        // 重新执行搜索
        if (this.currentPapers.length > 0) {
            if (this.keywords.size > 0) {
                this.performSearch();
            } else {
                this.displayAllPapers();
            }
        }
    }
    
    /**
     * 清空所有关键词
     */
    clearKeywords() {
        this.keywords.clear();
        this.updateKeywordsDisplay();
        
        // 显示所有论文
        if (this.currentPapers.length > 0) {
            this.displayAllPapers();
        }
    }
    
    /**
     * 更新关键词显示
     */
    updateKeywordsDisplay() {
        const container = this.elements.keywordsDisplay;
        container.innerHTML = '';
        
        if (this.keywords.size === 0) {
            container.classList.add('empty');
            return;
        }
        
        container.classList.remove('empty');
        
        Array.from(this.keywords).forEach(keyword => {
            const tag = document.createElement('div');
            tag.className = 'keyword-tag';
            tag.innerHTML = `
                <span>${keyword}</span>
                <button class="keyword-remove" onclick="paperSystem.removeKeyword('${keyword}')" title="移除关键词">
                    ×
                </button>
            `;
            container.appendChild(tag);
        });
    }
    
    /**
     * 执行搜索
     */
    performSearch() {
        if (this.currentPapers.length === 0) {
            this.updateStatus('请先加载论文数据', 'warning');
            return;
        }
        
        if (this.keywords.size === 0) {
            this.displayAllPapers();
            return;
        }
        
        this.showLoading('搜索中...');
        
        // 执行关键词匹配和排序
        const keywordArray = Array.from(this.keywords);
        this.searchResults = this.currentPapers.map(paper => {
            const matches = this.findKeywordMatches(paper, keywordArray);
            return {
                ...paper,
                matchCount: matches.length,
                matchedKeywords: matches,
                relevanceScore: this.calculateRelevanceScore(paper, matches, keywordArray)
            };
        }).filter(paper => paper.matchCount > 0);
        
        // 按匹配度排序：先按匹配关键词数量，再按相关性分数
        this.searchResults.sort((a, b) => {
            if (b.matchCount !== a.matchCount) {
                return b.matchCount - a.matchCount;
            }
            return b.relevanceScore - a.relevanceScore;
        });
        
        this.hideLoading();
        this.currentPage = 1;
        this.displaySearchResults();
        
        this.updateStatus(
            `找到 ${this.searchResults.length} 篇匹配的论文，关键词: ${keywordArray.join(', ')}`,
            'success'
        );
    }
    
    /**
     * 查找关键词匹配
     */
    findKeywordMatches(paper, keywords) {
        const matches = [];
        const searchText = paper.searchText;
        
        keywords.forEach(keyword => {
            if (searchText.includes(keyword)) {
                matches.push(keyword);
            }
        });
        
        return matches;
    }
    
    /**
     * 计算相关性分数
     */
    calculateRelevanceScore(paper, matches, allKeywords) {
        let score = 0;
        const searchText = paper.searchText;
        const title = (paper.title || '').toLowerCase();
        const abstract = (paper.abstract || '').toLowerCase();
        
        matches.forEach(keyword => {
            // 标题中的匹配权重更高
            if (title.includes(keyword)) {
                score += 10;
            }
            
            // 摘要中的匹配
            if (abstract.includes(keyword)) {
                score += 5;
            }
            
            // 计算关键词在文本中出现的频率
            const frequency = (searchText.match(new RegExp(keyword, 'g')) || []).length;
            score += frequency;
        });
        
        // 匹配关键词比例的奖励
        const matchRatio = matches.length / allKeywords.length;
        score += matchRatio * 20;
        
        return score;
    }
    
    /**
     * 显示所有论文
     */
    displayAllPapers() {
        this.searchResults = [...this.currentPapers];
        this.currentPage = 1;
        this.displaySearchResults();
    }
    
    /**
     * 显示搜索结果
     */
    displaySearchResults() {
        const container = this.elements.resultsContainer;
        const startIndex = (this.currentPage - 1) * this.papersPerPage;
        const endIndex = Math.min(startIndex + this.papersPerPage, this.searchResults.length);
        const papersToShow = this.searchResults.slice(startIndex, endIndex);
        
        container.innerHTML = '';
        
        if (papersToShow.length === 0) {
            container.innerHTML = `
                <div class="paper-card text-center">
                    <h3>没有找到匹配的论文</h3>
                    <p class="text-muted">请尝试使用不同的关键词或检查拼写</p>
                </div>
            `;
            this.elements.paginationContainer.innerHTML = '';
            return;
        }
        
        papersToShow.forEach(paper => {
            const paperCard = this.createPaperCard(paper);
            container.appendChild(paperCard);
        });
        
        this.updatePagination();
    }
    
    /**
     * 创建论文卡片
     */
    createPaperCard(paper) {
        const card = document.createElement('div');
        card.className = 'paper-card';
        
        const title = paper.title || 'Untitled';
        const authors = paper.authors || 'Unknown Authors';
        const abstract = paper.abstract || 'No abstract available';
        const venue = paper.venue || `${paper.conference} ${paper.year}`;
        
        // 截断摘要
        const truncatedAbstract = abstract.length > 500 
            ? abstract.substring(0, 500) + '...' 
            : abstract;
        
        // 创建匹配关键词的标签
        const matchBadges = paper.matchedKeywords ? 
            paper.matchedKeywords.map(keyword => 
                `<span class="match-badge">${keyword}</span>`
            ).join('') : '';
        
        // 创建链接
        const links = [];
        if (paper.pdf_url) {
            links.push(`<a href="${paper.pdf_url}" class="paper-link" target="_blank" rel="noopener">PDF</a>`);
        }
        if (paper.url && paper.url !== paper.pdf_url) {
            links.push(`<a href="${paper.url}" class="paper-link" target="_blank" rel="noopener">链接</a>`);
        }
        
        card.innerHTML = `
            <div class="paper-header">
                <h3 class="paper-title">${title}</h3>
                <p class="paper-authors">${authors}</p>
                <span class="paper-venue">${venue}</span>
            </div>
            
            <div class="paper-abstract">${truncatedAbstract}</div>
            
            <div class="paper-footer">
                <div class="keyword-matches">
                    ${matchBadges}
                    ${paper.matchCount ? `<span class="match-count">匹配 ${paper.matchCount} 个关键词</span>` : ''}
                </div>
                
                <div class="paper-links">
                    ${links.join('')}
                </div>
            </div>
        `;
        
        return card;
    }
    
    /**
     * 更新分页控件
     */
    updatePagination() {
        const container = this.elements.paginationContainer;
        const totalPages = Math.ceil(this.searchResults.length / this.papersPerPage);
        
        container.innerHTML = '';
        
        if (totalPages <= 1) {
            return;
        }
        
        // 上一页按钮
        const prevBtn = this.createPaginationButton('上一页', this.currentPage - 1, this.currentPage === 1);
        container.appendChild(prevBtn);
        
        // 页码按钮
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(totalPages, this.currentPage + 2);
        
        // 如果开始页不是1，显示第一页和省略号
        if (startPage > 1) {
            container.appendChild(this.createPaginationButton('1', 1));
            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'pagination-ellipsis';
                container.appendChild(ellipsis);
            }
        }
        
        // 显示当前页附近的页码
        for (let i = startPage; i <= endPage; i++) {
            const btn = this.createPaginationButton(i.toString(), i, false, i === this.currentPage);
            container.appendChild(btn);
        }
        
        // 如果结束页不是最后一页，显示省略号和最后一页
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'pagination-ellipsis';
                container.appendChild(ellipsis);
            }
            container.appendChild(this.createPaginationButton(totalPages.toString(), totalPages));
        }
        
        // 下一页按钮
        const nextBtn = this.createPaginationButton('下一页', this.currentPage + 1, this.currentPage === totalPages);
        container.appendChild(nextBtn);
    }
    
    /**
     * 创建分页按钮
     */
    createPaginationButton(text, page, disabled = false, active = false) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = `pagination-btn ${active ? 'active' : ''}`;
        btn.disabled = disabled;
        
        if (!disabled) {
            btn.addEventListener('click', () => {
                this.currentPage = page;
                this.displaySearchResults();
                
                // 滚动到结果区域顶部
                this.elements.resultsContainer.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            });
        }
        
        return btn;
    }
    
    /**
     * 更新状态显示
     */
    updateStatus(message, type = 'info') {
        const statusElement = this.elements.statusDisplay;
        const statusText = statusElement.querySelector('.status-text') || statusElement;
        
        statusText.textContent = message;
        
        // 移除所有状态类
        statusElement.classList.remove('status-success', 'status-error', 'status-warning');
        
        // 添加相应的状态类
        if (type !== 'info') {
            statusElement.classList.add(`status-${type}`);
        }
    }
    
    /**
     * 显示加载指示器
     */
    showLoading(message = '加载中...') {
        const overlay = this.elements.loadingOverlay;
        const text = overlay.querySelector('p');
        text.textContent = message;
        overlay.classList.add('show');
    }
    
    /**
     * 隐藏加载指示器
     */
    hideLoading() {
        this.elements.loadingOverlay.classList.remove('show');
    }
}

// 全局变量，用于在 HTML 中调用方法
let paperSystem;

// 页面加载完成后初始化系统
document.addEventListener('DOMContentLoaded', () => {
    paperSystem = new PaperSearchSystem();
});

// 导出类以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaperSearchSystem;
}

