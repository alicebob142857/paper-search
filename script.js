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
      conferenceSelect: document.getElementById("conferenceSelect"),
      yearSelect: document.getElementById("yearSelect"),
      loadDataBtn: document.getElementById("loadDataBtn"),
      keywordInput: document.getElementById("keywordInput"),
      addKeywordBtn: document.getElementById("addKeywordBtn"),
      searchBtn: document.getElementById("searchBtn"),
      clearKeywordsBtn: document.getElementById("clearKeywordsBtn"),
      keywordsDisplay: document.getElementById("keywordsDisplay"),
      statusDisplay: document.getElementById("statusDisplay"),
      resultsContainer: document.getElementById("resultsContainer"),
      paginationContainer: document.getElementById("paginationContainer"),
      loadingOverlay: document.getElementById("loadingOverlay"),
    };
  }

  /**
   * 系统初始化
   */
  async initialize() {
    this.setupEventListeners();
    await this.scanDataFiles();
    this.updateKeywordsDisplay();
    this.updateStatus("系统初始化完成，请选择会议和年份");
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 会议选择变化事件
    this.elements.conferenceSelect.addEventListener("change", () => {
      this.onConferenceChange();
    });

    // 加载数据按钮
    this.elements.loadDataBtn.addEventListener("click", () => {
      this.loadPaperData();
    });

    // 关键词输入事件
    this.elements.keywordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.addKeyword();
      }
    });

    // 添加关键词按钮
    this.elements.addKeywordBtn.addEventListener("click", () => {
      this.addKeyword();
    });

    // 搜索按钮
    this.elements.searchBtn.addEventListener("click", () => {
      this.performSearch();
    });

    // 清空关键词按钮
    this.elements.clearKeywordsBtn.addEventListener("click", () => {
      this.clearKeywords();
    });
  }

  /**
   * 扫描 data 文件夹中的可用文件
   */
  async scanDataFiles() {
    this.showLoading("扫描数据文件中...");

    // 预定义的会议列表（可以根据实际情况调整）
    const conferences = [
      "aaai",
      "nips",
      "icml",
      "iclr",
      "acl",
      "emnlp",
      "naacl",
      "cvpr",
      "iccv",
      "eccv",
      "sigir",
      "www",
      "kdd",
      "ijcai",
    ];

    // 可能的年份范围
    const years = [];
    const currentYear = new Date().getFullYear();
    for (let year = 2015; year <= currentYear; year++) {
      years.push(year.toString());
    }

    // 生成所有需要检查的文件路径
    const allFileChecks = [];
    for (const conference of conferences) {
      for (const year of years) {
        const fileName = `${conference}${year}.json`;
        const filePath = `data/${conference}/${fileName}`;

        allFileChecks.push({
          conference,
          year,
          fileName,
          filePath,
          checkPromise: this.checkFileExists(filePath),
        });
      }
    }

    console.log(`开始并行检查 ${allFileChecks.length} 个文件...`);

    // 并行检查所有文件是否存在
    const results = await Promise.allSettled(
      allFileChecks.map((item) => item.checkPromise)
    );

    // 处理结果
    const conferenceMap = new Map();

    results.forEach((result, index) => {
      const fileInfo = allFileChecks[index];

      if (result.status === "fulfilled" && result.value) {
        const conference = fileInfo.conference.toUpperCase();

        if (!conferenceMap.has(conference)) {
          conferenceMap.set(conference, []);
        }

        conferenceMap.get(conference).push({
          year: fileInfo.year,
          fileName: fileInfo.fileName,
          filePath: fileInfo.filePath,
        });
      }
    });

    // 按年份降序排序每个会议的文件
    for (const [conference, files] of conferenceMap.entries()) {
      files.sort((a, b) => parseInt(b.year) - parseInt(a.year));
    }

    this.availableFiles = conferenceMap;

    this.hideLoading();
    this.populateConferenceSelect();

    if (this.availableFiles.size === 0) {
      this.updateStatus(
        "未找到任何数据文件，请确保 data 文件夹中有正确的 JSON 文件",
        "error"
      );
    } else {
      this.updateStatus(
        `找到 ${this.availableFiles.size} 个会议的数据，请选择具体的会议和年份`,
        "success"
      );
    }
  }

  /**
   * 检查文件是否存在
   */
  async checkFileExists(filePath) {
    try {
      // 创建一个带超时的 Promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Request timeout")), 3000); // 3秒超时
      });

      const fetchPromise = fetch(filePath, {
        method: "HEAD",
        cache: "no-cache", // 避免缓存问题
      });

      // 使用 Promise.race 来实现超时控制
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      return response.ok;
    } catch (error) {
      // 超时或其他错误都返回 false
      return false;
    }
  }

  /**
   * 填充会议选择下拉框
   */
  populateConferenceSelect() {
    this.elements.conferenceSelect.innerHTML =
      '<option value="">请选择会议...</option>';

    // 按字母顺序排序会议名称
    const sortedConferences = Array.from(this.availableFiles.keys()).sort();

    sortedConferences.forEach((conference) => {
      const option = document.createElement("option");
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
    this.elements.yearSelect.innerHTML =
      '<option value="">请选择年份...</option>';

    if (selectedConference && this.availableFiles.has(selectedConference)) {
      const conferenceFiles = this.availableFiles.get(selectedConference);

      // 按年份降序排序
      conferenceFiles.sort((a, b) => parseInt(b.year) - parseInt(a.year));

      conferenceFiles.forEach((file) => {
        const option = document.createElement("option");
        option.value = file.year;
        option.textContent = file.year;
        option.dataset.filePath = file.filePath;
        this.elements.yearSelect.appendChild(option);
      });

      this.updateStatus(
        `${selectedConference} 会议有 ${conferenceFiles.length} 个年份的数据可用`
      );
    }
  }

  /**
   * 加载论文数据
   */
  async loadPaperData() {
    const selectedConference = this.elements.conferenceSelect.value;
    const selectedYear = this.elements.yearSelect.value;

    if (!selectedConference || !selectedYear) {
      this.updateStatus("请先选择会议和年份", "warning");
      return;
    }

    const selectedOption = this.elements.yearSelect.selectedOptions[0];
    const filePath = selectedOption.dataset.filePath;

    this.showLoading("加载论文数据中...");

    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.currentPapers = this.processPaperData(
        data,
        selectedConference,
        selectedYear
      );

      this.hideLoading();
      this.updateStatus(
        `成功加载 ${this.currentPapers.length} 篇 ${selectedConference} ${selectedYear} 的论文`,
        "success"
      );

      // 如果有关键词，自动执行搜索
      if (this.keywords.size > 0) {
        this.performSearch();
      } else {
        this.displayAllPapers();
      }
    } catch (error) {
      this.hideLoading();
      console.error("加载数据失败:", error);
      this.updateStatus(`加载数据失败: ${error.message}`, "error");
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
    } else if (typeof rawData === "object") {
      // 尝试从对象中提取论文数组
      const possibleKeys = ["papers", "data", "results", "items"];
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
      title: paper.title || paper.Title || "Untitled",
      authors:
        paper.authors || paper.Authors || paper.author || "Unknown Authors",
      // 新增：提取作者单位信息
      affiliations:
        paper.affiliations ||
        paper.Affiliations ||
        paper.aff ||
        paper.affiliation ||
        [],
      abstract: paper.abstract || paper.Abstract || paper.summary || "",
      conference: conference,
      year: year,
      url: paper.url || paper.link || paper.pdf_url || "",
      pdf_url: paper.pdf_url || paper.pdf || paper.url || "",
      keywords: paper.keywords || paper.Keywords || [],
      venue: paper.venue || `${conference} ${year}`,
      rating: paper.rating || paper.recommendation || paper.score || "",
      // 新增：提取状态信息
      status: paper.status || paper.Status || paper.type || paper.Type || "",
      award: paper.award || paper.Award || "",
      presentation: paper.presentation || paper.Presentation || "",
      track: paper.track || paper.Track || "",
      // 提取并计算rating平均分
      ratingScore: this.extractRating(
        paper.rating || paper.recommendation || paper.score
      ),
      // 计算状态分数
      statusScore: this.getStatusScore(paper),
      // 添加用于搜索的组合文本
      searchText: this.createSearchText(paper),
      // 保存原始数据
      originalData: paper,
    }));
  }

  /**
   * 格式化作者和单位信息
   */
  formatAuthorsWithAffiliations(authors, affiliations) {
    if (!authors) return "Unknown Authors";

    let authorText = "";

    // 处理不同格式的作者信息
    if (typeof authors === "string") {
      authorText = authors;
    } else if (Array.isArray(authors)) {
      // 如果authors是对象数组，尝试提取姓名和单位
      if (authors.length > 0 && typeof authors[0] === "object") {
        authorText = authors
          .map((author) => {
            const name = author.name || author.Name || author.author || "";
            const affiliation =
              author.affiliation || author.aff || author.institution || "";
            return affiliation ? `${name} (${affiliation})` : name;
          })
          .join(", ");
      } else {
        // 如果是字符串数组
        authorText = authors.join(", ");
      }
    }

    // 如果有单独的单位信息且作者信息中没有单位
    if (affiliations && !authorText.includes("(")) {
      if (typeof affiliations === "string") {
        authorText += ` (${affiliations})`;
      } else if (Array.isArray(affiliations) && affiliations.length > 0) {
        const affText = affiliations.join(", ");
        authorText += ` (${affText})`;
      }
    }

    return authorText || "Unknown Authors";
  }

  /**
   * 获取论文状态显示文本
   */
  getStatusDisplayText(paper) {
    const statusParts = [];

    // 收集所有状态信息
    if (paper.status) statusParts.push(paper.status);
    if (paper.award && !paper.status?.toLowerCase().includes("award")) {
      statusParts.push(paper.award);
    }

    // 显示评分信息而不是presentation
    if (paper.rating) {
      statusParts.push(`Rating: ${paper.rating}`);
    } else if (paper.recommendation) {
      statusParts.push(`Recommendation: ${paper.recommendation}`);
    }

    if (
      paper.track &&
      !statusParts.some((s) =>
        s.toLowerCase().includes(paper.track.toLowerCase())
      )
    ) {
      statusParts.push(paper.track);
    }

    return statusParts.length > 0 ? statusParts.join(" | ") : null;
  }

  /**
   * 获取状态显示的CSS类
   */
  getStatusClass(statusScore) {
    if (statusScore >= 90) return "status-award"; // 金色 - 奖项
    if (statusScore >= 80) return "status-oral"; // 蓝色 - oral/spotlight
    if (statusScore >= 65) return "status-accepted"; // 绿色 - 接收
    if (statusScore >= 40) return "status-poster"; // 灰色 - poster/workshop
    if (statusScore >= 20) return "status-short"; // 橙色 - short paper
    return "status-other"; // 默认
  }

  /**
   * 创建用于搜索的组合文本
   */
  createSearchText(paper) {
    const title = paper.title || paper.Title || "";
    const authors = paper.authors || paper.Authors || paper.author || "";
    const abstract = paper.abstract || paper.Abstract || paper.summary || "";
    const keywords = Array.isArray(paper.keywords)
      ? paper.keywords.join(" ")
      : paper.keywords || "";

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
      this.updateStatus(`关键词 "${keyword}" 已存在`, "warning");
      return;
    }

    this.keywords.add(keyword.toLowerCase());
    this.elements.keywordInput.value = "";
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
    container.innerHTML = "";

    if (this.keywords.size === 0) {
      container.classList.add("empty");
      return;
    }

    container.classList.remove("empty");

    Array.from(this.keywords).forEach((keyword) => {
      const tag = document.createElement("div");
      tag.className = "keyword-tag";
      tag.innerHTML = `
                <span>${keyword}</span>
                <button class="keyword-remove" onclick="paperSystem.removeKeyword('${keyword}')" title="移除关键词">
                    ×
                </button>
            `;
      container.appendChild(tag);
    });
  }

  findKeywordMatches(paper, keywords) {
    const matches = [];
    const searchText = paper.searchText;

    keywords.forEach((keyword) => {
      if (searchText && searchText.includes(keyword)) {
        matches.push(keyword);
      }
    });

    return matches;
  }

  /**
   * 执行搜索
   */
  performSearch() {
    console.log("开始搜索...");

    if (this.currentPapers.length === 0) {
      this.updateStatus("请先加载论文数据", "warning");
      return;
    }

    if (this.keywords.size === 0) {
      this.displayAllPapers();
      return;
    }

    this.showLoading("搜索中...");

    try {
      // 执行关键词匹配和排序
      const keywordArray = Array.from(this.keywords);
      console.log("搜索关键词:", keywordArray);

      this.searchResults = this.currentPapers
        .map((paper, index) => {
          if (index % 100 === 0) {
            console.log(`处理论文进度: ${index}/${this.currentPapers.length}`);
          }

          const matches = this.findKeywordMatches(paper, keywordArray);
          return {
            ...paper,
            matchCount: matches.length,
            matchedKeywords: matches,
            relevanceScore: this.calculateRelevanceScore(
              paper,
              matches,
              keywordArray
            ),
            // 添加这些属性（如果之前没有添加的话）
            ratingScore: this.extractRating
              ? this.extractRating(paper.rating)
              : 0,
            statusScore: this.getStatusScore ? this.getStatusScore(paper) : 0,
          };
        })
        .filter((paper) => paper.matchCount > 0);

      console.log("匹配结果数量:", this.searchResults.length);

      // 排序
      this.searchResults.sort((a, b) => {
        // 1. 首先按匹配的关键词数量排序
        if (b.matchCount !== a.matchCount) {
          return b.matchCount - a.matchCount;
        }

        // 2. 按rating排序（如果方法存在）
        if (typeof this.extractRating === "function") {
          const aRating = a.ratingScore || 0;
          const bRating = b.ratingScore || 0;
          if (Math.abs(bRating - aRating) > 0.001) {
            return bRating - aRating;
          }
        }

        // 3. 按status排序（如果方法存在）
        if (typeof this.getStatusScore === "function") {
          if (b.statusScore !== a.statusScore) {
            return b.statusScore - a.statusScore;
          }
        }

        // 4. 最后按相关性分数排序
        return b.relevanceScore - a.relevanceScore;
      });

      console.log("排序完成");

      this.hideLoading();
      this.currentPage = 1;
      this.displaySearchResults();

      this.updateStatus(
        `找到 ${
          this.searchResults.length
        } 篇匹配的论文，关键词: ${keywordArray.join(", ")}`,
        "success"
      );
    } catch (error) {
      console.error("搜索过程中出现错误:", error);
      this.hideLoading();
      this.updateStatus(`搜索失败: ${error.message}`, "error");
    }
  }

  extractRating(ratingData) {
    if (!ratingData) return null;

    let numbers = [];

    if (typeof ratingData === "number") {
      numbers.push(ratingData);
    } else if (typeof ratingData === "string") {
      // 提取字符串中的数字（包括小数）
      const matches = ratingData.match(/\d+(\.\d+)?/g);
      if (matches) {
        numbers = matches.map((num) => parseFloat(num));
      }
    } else if (Array.isArray(ratingData)) {
      // 处理数组格式的rating
      numbers = ratingData
        .map((item) => {
          if (typeof item === "number") return item;
          if (typeof item === "string") {
            const match = item.match(/\d+(\.\d+)?/);
            return match ? parseFloat(match[0]) : null;
          }
          return null;
        })
        .filter((num) => num !== null);
    } else if (typeof ratingData === "object") {
      // 处理对象格式的rating
      Object.values(ratingData).forEach((value) => {
        if (typeof value === "number") {
          numbers.push(value);
        } else if (typeof value === "string") {
          const match = value.match(/\d+(\.\d+)?/);
          if (match) numbers.push(parseFloat(match[0]));
        }
      });
    }

    if (numbers.length === 0) return null;

    // 计算平均值
    const average = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    return Math.round(average * 100) / 100; // 保留两位小数
  }

  getStatusScore(paper) {
    // 可能的状态字段
    const statusFields = [
      paper.status,
      paper.Status,
      paper.type,
      paper.Type,
      paper.award,
      paper.Award,
      paper.presentation,
      paper.Presentation,
      paper.track,
      paper.Track,
      paper.category,
      paper.Category,
    ];

    // 合并所有状态信息并转为小写
    const statusText = statusFields
      .filter((field) => field)
      .join(" ")
      .toLowerCase();

    // 状态优先级映射（分数越高优先级越高）
    const statusPriority = {
      // 最高优先级 - 奖项和口头报告
      "best paper": 100,
      "outstanding paper": 95,
      award: 90,
      oral: 85,
      keynote: 85,
      invited: 85,
      plenary: 85,

      // 高优先级 - spotlight等
      spotlight: 80,
      "contributed talk": 75,
      long: 70,
      "full paper": 70,
      accepted: 65,

      // 中等优先级 - poster
      poster: 50,
      demo: 45,
      workshop: 40,

      // 低优先级 - short paper等
      short: 30,
      "short paper": 30,
      brief: 25,
      "extended abstract": 20,

      // 最低优先级 - 拒绝/撤回
      reject: 5,
      rejected: 5,
      withdraw: 1,
      withdrawn: 1,
    };

    let maxScore = 0;

    // 检查每个状态关键词
    for (const [keyword, score] of Object.entries(statusPriority)) {
      if (statusText.includes(keyword)) {
        maxScore = Math.max(maxScore, score);
      }
    }

    return maxScore;
  }

  /**
   * 计算相关性分数
   */
  calculateRelevanceScore(paper, matches, allKeywords) {
    let score = 0;
    const searchText = paper.searchText;
    const title = (paper.title || "").toLowerCase();
    const abstract = (paper.abstract || "").toLowerCase();

    matches.forEach((keyword) => {
      // 标题中的匹配权重更高
      if (title.includes(keyword)) {
        score += 10;
      }

      // 摘要中的匹配
      if (abstract.includes(keyword)) {
        score += 5;
      }

      // 计算关键词在文本中出现的频率
      const frequency = (searchText.match(new RegExp(keyword, "g")) || [])
        .length;
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
    // 复制所有论文并添加排序所需的属性
    this.searchResults = this.currentPapers.map((paper) => ({
      ...paper,
      matchCount: 0,
      matchedKeywords: [],
      relevanceScore: 0,
      // 确保有rating和status分数
      ratingScore: paper.ratingScore || this.extractRating(paper.rating) || 0,
      statusScore: paper.statusScore || this.getStatusScore(paper) || 0,
    }));

    // 按rating和status排序
    this.searchResults.sort((a, b) => {
      // 1. 首先按rating分数排序（降序）
      const aRating = a.ratingScore || 0;
      const bRating = b.ratingScore || 0;
      if (Math.abs(bRating - aRating) > 0.001) {
        return bRating - aRating;
      }

      // 2. 如果rating相同或都没有rating，按status分数排序（降序）
      const aStatus = a.statusScore || 0;
      const bStatus = b.statusScore || 0;
      if (bStatus !== aStatus) {
        return bStatus - aStatus;
      }

      // 3. 如果status也相同，按标题字母顺序排序
      const aTitle = (a.title || "").toLowerCase();
      const bTitle = (b.title || "").toLowerCase();
      return aTitle.localeCompare(bTitle);
    });

    console.log("无搜索词排序完成，按rating和status排序");

    this.currentPage = 1;
    this.displaySearchResults();

    // 更新状态信息，显示排序方式
    const hasRatings = this.searchResults.some(
      (paper) => paper.ratingScore > 0
    );
    const hasStatus = this.searchResults.some((paper) => paper.statusScore > 0);

    let sortInfo = "";
    if (hasRatings && hasStatus) {
      sortInfo = "已按评分和状态排序";
    } else if (hasRatings) {
      sortInfo = "已按评分排序";
    } else if (hasStatus) {
      sortInfo = "已按状态排序";
    } else {
      sortInfo = "已按标题排序";
    }

    this.updateStatus(
      `显示全部 ${this.searchResults.length} 篇论文，${sortInfo}`,
      "success"
    );
  }

  /**
   * 显示搜索结果
   */
  displaySearchResults() {
    const container = this.elements.resultsContainer;
    const startIndex = (this.currentPage - 1) * this.papersPerPage;
    const endIndex = Math.min(
      startIndex + this.papersPerPage,
      this.searchResults.length
    );
    const papersToShow = this.searchResults.slice(startIndex, endIndex);

    container.innerHTML = "";

    if (papersToShow.length === 0) {
      container.innerHTML = `
                <div class="paper-card text-center">
                    <h3>没有找到匹配的论文</h3>
                    <p class="text-muted">请尝试使用不同的关键词或检查拼写</p>
                </div>
            `;
      this.elements.paginationContainer.innerHTML = "";
      return;
    }

    papersToShow.forEach((paper) => {
      const paperCard = this.createPaperCard(paper);
      container.appendChild(paperCard);
    });

    this.updatePagination();
  }

  // 传入原摘要文本和需要高亮的关键词数组
  highlightKeywords(text, keywords) {
    if (!text || keywords.length === 0) return text;

    try {
      let highlightedText = text;
      // 按长度降序，避免短词覆盖长词高亮
      const sortedKeywords = keywords
        .slice()
        .sort((a, b) => b.length - a.length);

      sortedKeywords.forEach((keyword) => {
        if (keyword && keyword.length > 0) {
          // 简化正则表达式，避免复杂匹配导致的性能问题
          const escapedKeyword = keyword.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\__CODE_BLOCK_0__"
          );
          const regex = new RegExp(`(${escapedKeyword})`, "gi");
          highlightedText = highlightedText.replace(
            regex,
            '<span class="highlight">$1</span>'
          );
        }
      });

      return highlightedText;
    } catch (error) {
      console.error("高亮关键词时出错:", error);
      return text; // 出错时返回原文本
    }
  }
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\__CODE_BLOCK_0__");
  }

  /**
   * 创建论文卡片
   */
  createPaperCard(paper) {
    const card = document.createElement("div");
    card.className = "paper-card";

    const title = paper.title || "Untitled";
    const authors = paper.authors || "Unknown Authors";
    const abstract = paper.abstract || "No abstract available";
    const venue = paper.venue || `${paper.conference} ${paper.year}`;

    // 截断摘要
    const keywords = paper.matchedKeywords ?? [];
    const truncatedAbstract = abstract;
    const highlightedAbstract = this.highlightKeywords(
      truncatedAbstract,
      keywords
    );

    // 创建匹配关键词的标签
    const matchBadges = paper.matchedKeywords
      ? paper.matchedKeywords
          .map((keyword) => `<span class="match-badge">${keyword}</span>`)
          .join("")
      : "";

    // 创建链接
    const links = [];
    if (paper.pdf_url) {
      links.push(
        `<a href="${paper.pdf_url}" class="paper-link" target="_blank" rel="noopener">PDF</a>`
      );
    }
    if (paper.url && paper.url !== paper.pdf_url) {
      links.push(
        `<a href="${paper.url}" class="paper-link" target="_blank" rel="noopener">链接</a>`
      );
    }

    card.innerHTML = `
            <div class="paper-header">
                <h3 class="paper-title">${title}</h3>
                <p class="paper-authors">${authors}</p>
                <span class="paper-venue">${venue}</span>
            </div>
            
            <div class="paper-abstract">${highlightedAbstract}</div>
            
            <div class="paper-footer">
                <div class="keyword-matches">
                    ${matchBadges}
                    ${
                      paper.matchCount
                        ? `<span class="match-count">匹配 ${paper.matchCount} 个关键词</span>`
                        : ""
                    }
                </div>
                
                <div class="paper-links">
                    ${links.join("")}
                </div>
            </div>
        `;

    return card;
  }
  createPaperCard(paper) {
    const card = document.createElement("div");
    card.className = "paper-card";

    const title = paper.title || "Untitled";
    const authorsWithAff = this.formatAuthorsWithAffiliations(
      paper.authors,
      paper.affiliations
    );
    const abstract = paper.abstract || "No abstract available";
    const venue = paper.venue || `${paper.conference} ${paper.year}`;

    // 高亮处理
    const keywords = paper.matchedKeywords ?? [];
    const truncatedAbstract = abstract;
    const highlightedAbstract = this.highlightKeywords(
      truncatedAbstract,
      keywords
    );
    const highlightedTitle = this.highlightKeywords(title, keywords);

    // 状态信息
    const statusText = this.getStatusDisplayText(paper);
    const statusClass = this.getStatusClass(paper.statusScore || 0);
    const statusDisplay = statusText
      ? `<span class="paper-status ${statusClass}">${statusText}</span>`
      : "";

    // 评分信息
    const ratingDisplay = paper.ratingScore
      ? `<span class="paper-rating">评分: ${paper.ratingScore}</span>`
      : "";

    // 创建匹配关键词的标签
    const matchBadges = paper.matchedKeywords
      ? paper.matchedKeywords
          .map((keyword) => `<span class="match-badge">${keyword}</span>`)
          .join("")
      : "";

    // 创建链接
    const links = [];
    if (paper.pdf_url) {
      links.push(
        `<a href="${paper.pdf_url}" class="paper-link" target="_blank" rel="noopener">📄 PDF</a>`
      );
    }
    if (paper.url && paper.url !== paper.pdf_url) {
      links.push(
        `<a href="${paper.url}" class="paper-link" target="_blank" rel="noopener">🔗 链接</a>`
      );
    }

    card.innerHTML = `
      <div class="paper-header">
        <h3 class="paper-title">${highlightedTitle}</h3>
        <p class="paper-authors">${authorsWithAff}</p>
        <div class="paper-meta">
          <span class="paper-venue">${venue}</span>
          ${statusDisplay}
          ${ratingDisplay}
        </div>
      </div>
      
      <div class="paper-abstract">${highlightedAbstract}</div>
      
      <div class="paper-footer">
        <div class="keyword-matches">
          ${matchBadges}
          ${
            paper.matchCount
              ? `<span class="match-count">匹配 ${paper.matchCount} 个关键词</span>`
              : ""
          }
        </div>
        
        <div class="paper-links">
          ${links.join("")}
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
    const totalPages = Math.ceil(
      this.searchResults.length / this.papersPerPage
    );

    container.innerHTML = "";

    if (totalPages <= 1) {
      return;
    }

    // 上一页按钮
    const prevBtn = this.createPaginationButton(
      "上一页",
      this.currentPage - 1,
      this.currentPage === 1
    );
    container.appendChild(prevBtn);

    // 页码按钮
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    // 如果开始页不是1，显示第一页和省略号
    if (startPage > 1) {
      container.appendChild(this.createPaginationButton("1", 1));
      if (startPage > 2) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        ellipsis.className = "pagination-ellipsis";
        container.appendChild(ellipsis);
      }
    }

    // 显示当前页附近的页码
    for (let i = startPage; i <= endPage; i++) {
      const btn = this.createPaginationButton(
        i.toString(),
        i,
        false,
        i === this.currentPage
      );
      container.appendChild(btn);
    }

    // 如果结束页不是最后一页，显示省略号和最后一页
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "...";
        ellipsis.className = "pagination-ellipsis";
        container.appendChild(ellipsis);
      }
      container.appendChild(
        this.createPaginationButton(totalPages.toString(), totalPages)
      );
    }

    // 下一页按钮
    const nextBtn = this.createPaginationButton(
      "下一页",
      this.currentPage + 1,
      this.currentPage === totalPages
    );
    container.appendChild(nextBtn);
  }

  /**
   * 创建分页按钮
   */
  createPaginationButton(text, page, disabled = false, active = false) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.className = `pagination-btn ${active ? "active" : ""}`;
    btn.disabled = disabled;

    if (!disabled) {
      btn.addEventListener("click", () => {
        this.currentPage = page;
        this.displaySearchResults();

        // 滚动到结果区域顶部
        this.elements.resultsContainer.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }

    return btn;
  }

  /**
   * 更新状态显示
   */
  updateStatus(message, type = "info") {
    const statusElement = this.elements.statusDisplay;
    const statusText =
      statusElement.querySelector(".status-text") || statusElement;

    statusText.textContent = message;

    // 移除所有状态类
    statusElement.classList.remove(
      "status-success",
      "status-error",
      "status-warning"
    );

    // 添加相应的状态类
    if (type !== "info") {
      statusElement.classList.add(`status-${type}`);
    }
  }

  /**
   * 显示加载指示器
   */
  showLoading(message = "加载中...") {
    const overlay = this.elements.loadingOverlay;
    const text = overlay.querySelector("p");
    text.textContent = message;
    overlay.classList.add("show");
  }

  /**
   * 隐藏加载指示器
   */
  hideLoading() {
    this.elements.loadingOverlay.classList.remove("show");
  }
}

// 全局变量，用于在 HTML 中调用方法
let paperSystem;

// 页面加载完成后初始化系统
document.addEventListener("DOMContentLoaded", () => {
  paperSystem = new PaperSearchSystem();
});

// 导出类以供其他模块使用
if (typeof module !== "undefined" && module.exports) {
  module.exports = PaperSearchSystem;
}
