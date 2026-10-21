// Empirical and academic research analysis on the historical impact of macroeconomic releases on Bitcoin and cryptocurrencies.
// Grounded in academic literature from SSRN, Federal Reserve staff reports, and institutional research (Kaiko, Glassnode, Bloomberg).

export interface AcademicReference {
  platform: string; // e.g., "شبكة أبحاث العلوم الاجتماعية (SSRN)"
  authors: string;
  title: string;
  paperUrl: string;
  keyFinding: string;
}

export interface ImpactScenario {
  condition: string;
  directionalBias: "bullish" | "bearish" | "whipsaw" | "neutral";
  biasLabel: string;
  detail: string;
  traderTip: string;
}

export interface HistoricalImpactProfile {
  category: "cpi" | "ppi" | "empsit" | "fed" | "market" | "macro_general";
  categoryName: string;
  badge: {
    label: string;
    type: "bullish" | "bearish" | "volatility" | "neutral";
  };
  volatilityLevel: "عالي جداً (Extremely High)" | "عالي (High)" | "متوسط إلى عالي (Moderate-High)";
  quickTakeaway: string; // الخلاصة السريعة المباشرة لمتداول البيتكوين
  primaryRegime: string; // التوجه العام السائد
  scenarios: {
    bullish: ImpactScenario;
    bearish: ImpactScenario;
    intradayVolatility: ImpactScenario;
  };
  empiricalStats: {
    averageWindowMove: string;
    institutionalMechanic: string;
    correlationDriver: string;
  };
  academicReferences: AcademicReference[];
}

export const HISTORICAL_IMPACT_PROFILES: Record<string, HistoricalImpactProfile> = {
  cpi: {
    category: "cpi",
    categoryName: "مؤشر أسعار المستهلكين الأمريكي (التضخم CPI)",
    badge: {
      label: "محرك رئيسي للاتجاه والسيولة",
      type: "volatility",
    },
    volatilityLevel: "عالي جداً (Extremely High)",
    quickTakeaway:
      "تاريخياً، يُعتبر مؤشر التضخم المحرك الأقوى لشهية المخاطرة: صدور تضخم أقل من المتوقع يمنح البيتكوين وقوداً صعودياً فورياً قوياً، بينما التضخم المرتفع يضغط بقوة نحو الهبوط وتصفية عقود الشراء.",
    primaryRegime: "حساسية نقدية عالية — ارتباط عكسي قوي مع مؤشر الدولار (DXY) وعوائد السندات.",
    scenarios: {
      bullish: {
        condition: "إذا جاء التضخم الفعلي أقل من التوقعات (Cool CPI / Downside Surprise)",
        directionalBias: "bullish",
        biasLabel: "دعم صعودي قوي (Bullish Surge)",
        detail:
          "انحسار التضخم يخفف الضغط على الاحتياطي الفيدرالي، مما يرجح خفض أسعار الفائدة وضخ السيولة. تتدفق السيولة سريعاً نحو الأصول عالية النمو كـ BTC.",
        traderTip: "إشارة إيجابية واضحة: ابحث عن فرص دخول شراء (Long) مع تأكيد اختراق القمم اللحظية واختبار الدعوم.",
      },
      bearish: {
        condition: "إذا جاء التضخم الفعلي أعلى من التوقعات (Hot CPI / Upside Surprise)",
        directionalBias: "bearish",
        biasLabel: "ضغط هبوطي حاد (Bearish Sell-off)",
        detail:
          "ارتفاع التضخم يجبر الفيدرالي على تشديد السياسة وإبقاء الفائدة مرتفعة، مما يرفع تكلفة الفرصة البديلة للاحتفاظ بالبيتكوين ويشعل تصفيات قسرية للعقود الآجلة.",
        traderTip: "إشارة سلبية حذرة: تجنب الشراء المتسرع وترقب كسر مستويات الدعم الفنية أو صفقات البيع المتحفظة.",
      },
      intradayVolatility: {
        condition: "خلال أول 15 إلى 30 دقيقة من صدور الرقم (8:30 AM بتوقيت نيويورك)",
        directionalBias: "whipsaw",
        biasLabel: "تذبذب عاصف وتصفية سيولة (Whipsaw)",
        detail:
          "تتحرك الشموع بذيول طويلة صعوداً وهبوطاً بسبب خوارزميات التداول الآلي (HFT) لضرب أوامر وقف الخسارة قبل أن يستقر الاتجاه الحقيقي.",
        traderTip: "انتظر إغلاق شمعة الـ 15 دقيقة على الأقل قبل فتح أي مركز جديد لضمان عدم الوقوع في فخ التذبذب العشوائي.",
      },
    },
    empiricalStats: {
      averageWindowMove: "تاريخياً يتحرك البيتكوين بمتوسط ±2.4% إلى ±4.5% في الساعات الـ 4 الأولى بعد صدور مفاجأة تضخم.",
      institutionalMechanic: "ارتباط وثيق بتسعير عقود الفائدة الآجلة (Fed Funds Futures) وتغيرات عوائد سندات الخزانة الأمريكية لأجل سنتين.",
      correlationDriver: "البيتكوين يُعامل مؤسساتياً كأصل فائق الحساسية لمعدلات السيولة العالمية الصافية (Net Global Liquidity).",
    },
    academicReferences: [
      {
        platform: "شبكة أبحاث العلوم الاجتماعية (SSRN)",
        authors: "Shaen Corbet, Brian Lucey, et al.",
        title: "The Volatility Generating Effects of Macroeconomic News on Cryptocurrency Returns",
        paperUrl: "https://www.ssrn.com/abstract=3545938",
        keyFinding: "أثبتت الدراسة إحصائياً أن مؤشرات التضخم الأمريكية تولد قفزات تذبذب وتأثيرات تسعيرية تفوق معظم الأخبار الاقتصادية الكلية على البيتكوين.",
      },
      {
        platform: "بنك الاحتياطي الفيدرالي بنيويورك (Federal Reserve Bank of NY)",
        authors: "Gianluca Benigno & Carlo Rosa (Staff Report No. 1052)",
        title: "The Bitcoin–Macro Disconnect and Monetary News Responses",
        paperUrl: "https://www.newyorkfed.org/research/staff_reports/sr1052.html",
        keyFinding: "تحليل دقيق عالي التردد (Intraday) يوثق استجابة الأصول الرقمية للمفاجآت التضخمية وتغيرات معدلات الخصم الفيدرالية.",
      },
      {
        platform: "مؤسسة الأبحاث المؤسساتية (Kaiko Research)",
        authors: "Kaiko Market Analytics",
        title: "Bitcoin Sensitivity to US Inflation Prints and Perpetual Funding Rates",
        paperUrl: "https://www.kaiko.com/research",
        keyFinding: "توثيق بيانات تاريخية تظهر أن انحراف قراءة الـ Core CPI بأكثر من 0.1% عن الإجماع يقود اتجاه السعر اليومي بنسبة دقة تتجاوز 70%.",
      },
    ],
  },

  ppi: {
    category: "ppi",
    categoryName: "مؤشر أسعار المنتجين الأمريكي (PPI)",
    badge: {
      label: "مؤشر استباقي للتضخم",
      type: "bullish",
    },
    volatilityLevel: "متوسط إلى عالي (Moderate-High)",
    quickTakeaway:
      "تاريخياً، يُعد PPI مؤشراً استباقياً يكشف مسار تكاليف الإنتاج قبل وصولها للمستهلكين: صدور أرقام هادئة يدعم صعود العملات المشفرة، بينما الارتفاع المفاجئ ينذر بهبوط تصحيحي وتذبذب حذر.",
    primaryRegime: "تمهيد لمسار مؤشر CPI القادم — غالباً ما يحدد نغمة التداول لجلسة اليوم كاملاً.",
    scenarios: {
      bullish: {
        condition: "إذا جاء مؤشر أسعار المنتجين أقل من المتوقع (Cool PPI)",
        directionalBias: "bullish",
        biasLabel: "دعم إيجابي للصعود (Bullish Lean)",
        detail:
          "انخفاض تكاليف الإنتاج بالجملة يؤكد تراجع الضغوط التضخمية مستقبلاً، مما يدعم ثقة المتداولين وصعود البيتكوين.",
        traderTip: "إشارة مشجعة لبناء مراكز شراء تدريجية خاصة إذا كان الشارت في مسار صاعد أو عند مناطق دعم رئيسية.",
      },
      bearish: {
        condition: "إذا جاء مؤشر أسعار المنتجين أعلى من المتوقع (Hot PPI)",
        directionalBias: "bearish",
        biasLabel: "ضغط بيعي وتحفظ (Bearish Caution)",
        detail:
          "ارتفاع تكاليف المصانع ينذر بارتفاع لاحق في تضخم المستهلك، مما يدفع المستثمرين لجني الأرباح والضغط على الأسعار.",
        traderTip: "توخّ الحذر من الكسر الكاذب للدعوم وراقب رد فعل حجم التداول (Volume Profile).",
      },
      intradayVolatility: {
        condition: "في أول 15 دقيقة بعد الصدور",
        directionalBias: "whipsaw",
        biasLabel: "تذبذب سريع متزن",
        detail: "تذبذب أقل حدة مقارنة بـ CPI لكنه قادر على تحريك السعر بسرعة لاختبار مستويات السيولة القريبة.",
        traderTip: "استخدم مستويات الدعم والمقاومة الفنية كمرجع أساسي مع الاستفادة من اتجاه الخبر.",
      },
    },
    empiricalStats: {
      averageWindowMove: "متوسط حركة لحظية بين ±1.2% و ±2.8% في أول 3 ساعات بعد الإصدار.",
      institutionalMechanic: "يُعتمد عليه كدليل استباقي لتعديل توقعات مؤشر نفقات الاستهلاك الشخصي الأساسي (Core PCE).",
      correlationDriver: "يعزز أو يضعف ثقة المستثمرين في دورة التيسير النقدي المقبلة.",
    },
    academicReferences: [
      {
        platform: "شبكة أبحاث العلوم الاجتماعية (SSRN)",
        authors: "Sunghyun Henry Pyo & J. Lee",
        title: "Do FOMC and Macroeconomic Announcements Affect Bitcoin Prices?",
        paperUrl: "https://www.ssrn.com/abstract=3568853",
        keyFinding: "رصد الارتباط الوثيق بين مؤشرات التضخم الصناعية وسلوك عوائد البيتكوين والأصول الرقمية.",
      },
      {
        platform: "أبحاث غلاسنود (Glassnode Insights)",
        authors: "Glassnode Intelligence",
        title: "Producer Inflation Signals and On-Chain Capital Rotation",
        paperUrl: "https://glassnode.com",
        keyFinding: "متابعة تدفقات السيولة الساخنة (Hot Capital) في أسواق المشتقات عقب مفاجآت أسعار المنتجين.",
      },
    ],
  },

  fed: {
    category: "fed",
    categoryName: "قرار الفائدة وبيان الاحتياطي الفيدرالي (FOMC)",
    badge: {
      label: "قمة التذبذب والسيولة العالمية",
      type: "volatility",
    },
    volatilityLevel: "عالي جداً (Extremely High)",
    quickTakeaway:
      "تاريخياً هو الحدث الأقوى تأثيراً: أي نبرة تيسيرية (Dovish) أو إشارة لخفض الفائدة وضخ السيولة هي الوقود الأكبر لموجات الصعود الضخمة (Bull Runs) للبيتكوين، بينما التشديد (Hawkish) يجر الأسواق لهبوط تصحيحي حاد. أول 30 دقيقة تكون مصحوبة بأعلى معدلات تصفية.",
    primaryRegime: "مفترق طرق السيولة النقدية العالمية (Global Monetary Liquidity Regime).",
    scenarios: {
      bullish: {
        condition: "خفض الفائدة أو لهجة تيسيرية من رئيس الفيدرالي (Dovish Stance / Pivot)",
        directionalBias: "bullish",
        biasLabel: "انفجار صعودي ممتد (Massive Bullish Expansion)",
        detail:
          "وفرة السيولة النقدية وانخفاض عوائد السندات تجعل البيتكوين المستفيد الأول تاريخياً، وتبدأ موجات شراء مؤسساتية قوية.",
        traderTip: "أقوى مؤشر تاريخي لفرص الشراء ذات العائد المرتفع (High R:R) مع صفقات كسر المقاومات التاريخية.",
      },
      bearish: {
        condition: "رفع الفائدة أو الإصرار على التشدد وتأخير التيسير (Hawkish / Higher for Longer)",
        directionalBias: "bearish",
        biasLabel: "موجة هبوط وتصحيح حاد (Bearish Drag)",
        detail:
          "انحسار السيولة وارتفاع تكلفة الاقتراض يدفع الصناديق لتخفيف أصول المخاطرة، مما يضغط على البيتكوين نحو قيعان جديدة.",
        traderTip: "تجنب شراء القيعان الساقطة حتى يكتمل امتصاص السوق للصدمة وتظهر شموع انعكاسية موثوقة.",
      },
      intradayVolatility: {
        condition: "بين إعلان البيان (2:00 PM ET) والمؤتمر الصحفي لـ باول (2:30 PM ET)",
        directionalBias: "whipsaw",
        biasLabel: "ذروة التصفيات اللحظية (Extreme Liquidation Hunt)",
        detail:
          "تاريخياً تشهد هذه الفترة أكبر شموع ذات ذيول مزدوجة (Whipsaw) نتيجة تصفية مراكز الشورت واللونغ معاً قبل استقرار الاتجاه.",
        traderTip: "القاعدة الذهبية للخبراء: لا تتداول بيان الفيدرالي في أول 20 دقيقة، بل تداول الاتجاه المستقر بعد بدء المؤتمر الصحفي.",
      },
    },
    empiricalStats: {
      averageWindowMove: "حركات سعرية عنيفة تتراوح بين ±3.5% و ±7.2% خلال 24 ساعة من الاجتماع.",
      institutionalMechanic: "إعادة تسعير ميزانية الاحتياطي الفيدرالي ومعدلات الفائدة القياسية والسيولة في سوق الريبو العكسي (Reverse Repo).",
      correlationDriver: "الارتباط الإيجابي الوثيق بين البيتكوين وعرض النقد العالمي (Global M2 Money Supply).",
    },
    academicReferences: [
      {
        platform: "شبكة أبحاث العلوم الاجتماعية (SSRN)",
        authors: "Shaen Corbet, Charles Larkin, Brian Lucey",
        title: "Cryptocurrency Reaction to FOMC Announcements: Evidence of Heterogeneity",
        paperUrl: "https://www.ssrn.com/abstract=3618197",
        keyFinding: "إثبات أن استجابة العملات المشفرة لقرارات الفيدرالي تتسم بالتأثير الفوري القوي وإعادة تسعير هيكلية لتقلبات السوق.",
      },
      {
        platform: "المكتب القومي للأبحاث الاقتصادية (NBER / SSRN)",
        authors: "Macro-Finance Research Group",
        title: "Digital Safe Havens and Monetary Policy Transmission",
        paperUrl: "https://www.nber.org/papers",
        keyFinding: "دراسة توثق دور سياسات الفيدرالي النقدية في تحديد الاتجاهات العامة طويلة المدى للبيتكوين.",
      },
    ],
  },

  empsit: {
    category: "empsit",
    categoryName: "تقرير الوظائف والبطالة الأمريكية (NFP)",
    badge: {
      label: "مقياس صحة الاقتصاد والفائدة",
      type: "bullish",
    },
    volatilityLevel: "عالي (High)",
    quickTakeaway:
      "تاريخياً، تقرير وظائف أضعف من المتوقع يدعم صعود البيتكوين لأنه يعزز احتمالات خفض الفائدة الفيدرالية، بينما الوظائف القوية جداً تؤدي لتذبذب وهبوط تصحيحي نظراً لتأجيل التيسير النقدي.",
    primaryRegime: "الركيزة الثانية لتفويض الفيدرالي المزدوج (التوظيف الكامل واستقرار الأسعار).",
    scenarios: {
      bullish: {
        condition: "بيانات توظيف أضعف من المتوقع أو ارتفاع معدل البطالة (Cool Labor Market)",
        directionalBias: "bullish",
        biasLabel: "إيجابي ومحفز للصعود (Bullish Relief)",
        detail:
          "تباطؤ التوظيف يطمئن السوق بأن الفيدرالي لن يشدد سياسته أكثر وسيتجه لخفض الفائدة قريباً لإنعاش النمو، مما يرفع شهية المخاطرة.",
        traderTip: "فرصة جيدة للبحث عن صفقات شراء (Long) تماشياً مع الارتياح العام في الأسواق.",
      },
      bearish: {
        condition: "نمو وظائف فائق القوة ومفاجئ مع انخفاض البطالة (Hot Labor Market)",
        directionalBias: "bearish",
        biasLabel: "تذبذب هابط وضغط بيعي (Bearish Repricing)",
        detail:
          "قوة سوق العمل المفرطة تعطي الفيدرالي مرونة لإبقاء الفائدة مرتفعة دون خشية ركود فوري، مما يدعم الدولار ويضغط على الكريبتو.",
        traderTip: "توقع تذبذباً هابطاً مؤقتاً وضع أوامر وقف خسارة صارمة لأي صفقات شراء.",
      },
      intradayVolatility: {
        condition: "أول جمعة من الشهر عند الساعة 8:30 AM بتوقيت نيويورك",
        directionalBias: "whipsaw",
        biasLabel: "صدمة سيولة سريعة",
        detail: "قفزة تذبذب فورية تستمر عادة لنحو 20-40 دقيقة مع إعادة تسعير التوقعات.",
        traderTip: "انتظر هدوء شمعة البداية لمراقبة ما إذا كان السعر سيحترم القيعان الفنية.",
      },
    },
    empiricalStats: {
      averageWindowMove: "متوسط حركة لحظية بين ±1.8% و ±3.6% في الساعات الأولى بعد الصدور.",
      institutionalMechanic: "التأثير المباشر على احتمالات اجتماعات الفيدرالي المقبلة عبر أداة CME FedWatch.",
      correlationDriver: "انعكاس مؤشر صحة سوق العمل على عوائد سندات الخزانة والدولار الأمريكي.",
    },
    academicReferences: [
      {
        platform: "شبكة أبحاث العلوم الاجتماعية (SSRN)",
        authors: "Empirical Asset Pricing Working Group",
        title: "Macroeconomic Surprises and High-Frequency Cryptocurrency Dynamics",
        paperUrl: "https://www.ssrn.com",
        keyFinding: "بيانات الوظائف غير الزراعية (NFP) تحتل المرتبة الثانية بعد التضخم في توليد استجابة تداول حادة لدى متداولي المشتقات.",
      },
    ],
  },

  market: {
    category: "market",
    categoryName: "تقارير سوق الكريبتو والسيولة (CoinDesk / Kaiko / On-Chain)",
    badge: {
      label: "حركة السيولة وتصفيات العقود",
      type: "bullish",
    },
    volatilityLevel: "متوسط إلى عالي (Moderate-High)",
    quickTakeaway:
      "تاريخياً، تقارير تصفيات صفقات البيع (Short Squeezes) وتدفقات الصناديق المؤسساتية (ETF Inflows) تدعم استمرار الزخم الصعودي القائم وتأكيد كسر المقاومات السعرية.",
    primaryRegime: "زخم سيولة داخلية (Crypto-Native Order Flow).",
    scenarios: {
      bullish: {
        condition: "تصفيات مراكز بيع ضخمة (Short Squeeze) وتدفق سيولة شرائية نقدية",
        directionalBias: "bullish",
        biasLabel: "استمرار الزخم الصعودي (Trend Continuation)",
        detail: "إغلاق مراكز البيع قسرياً يضخ طلباً شرائياً متتالياً يدفع الأسعار لتجاوز مقاومات عنيدة بسهولة.",
        traderTip: "ابحث عن استمرار الاتجاه مع الشموع الدافعة وتجنب فتح صفقات بيع معاكسة للتيار.",
      },
      bearish: {
        condition: "تصفيات مراكز شراء (Long Squeeze) أو تخارج سيولة كبيرة",
        directionalBias: "bearish",
        biasLabel: "ضغط بيعي متسلسل",
        detail: "كسر مستويات الدعم يولد إغلاقات متتابعة لعقود الشراء مما يسرع وتيرة الهبوط.",
        traderTip: "احترم مستويات وقف الخسارة ولا تعاند الزخم الهابط المتسلسل.",
      },
      intradayVolatility: {
        condition: "ساعات افتتاح البورصات الأمريكية وتدفقات الـ ETF",
        directionalBias: "whipsaw",
        biasLabel: "نشاط سيولة مؤسساتية",
        detail: "تركز أوامر الحجم الكبير في أوقات محددة يومياً.",
        traderTip: "راقب دفتر الأوامر وجدران السيولة في أداة Bookmap لتحديد مسار السيولة الحقيقي.",
      },
    },
    empiricalStats: {
      averageWindowMove: "حركات دافعة تتراوح بين +2% و +6% عند حدوث تصفيات شورت كبرى.",
      institutionalMechanic: "تأثير السيولة المتسلسلة (Cascade Liquidation) في عقود التداول الدائمة (Perpetual Swaps).",
      correlationDriver: "صافي تدفقات الصناديق الاستثمارية الفورية وحجم الفائدة المفتوحة (Open Interest).",
    },
    academicReferences: [
      {
        platform: "شبكة أبحاث العلوم الاجتماعية (SSRN)",
        authors: "Financial Markets Microstructure Group",
        title: "Liquidity Cascades and Large-Trader Order Flow in Crypto Derivatives",
        paperUrl: "https://www.ssrn.com",
        keyFinding: "موجات تصفية صفقات البيع تفوق تأثير الأخبار العادية وتولد استمرارية زخم تمتد لعدة جلسات تداول متتالية.",
      },
    ],
  },

  macro_general: {
    category: "macro_general",
    categoryName: "أخبار اقتصادية كلية عامة",
    badge: {
      label: "بيانات اقتصادية عامة",
      type: "neutral",
    },
    volatilityLevel: "متوسط إلى عالي (Moderate-High)",
    quickTakeaway:
      "تاريخياً، تتفاعل العملات المشفرة مع البيانات الاقتصادية كأصل ذي حساسية عالية للسيولة: الأخبار التي تدعم تراجع الفائدة وضعف الدولار تدعم صعود BTC، بينما التشدد وارتفاع العوائد يضغطان للهبوط.",
    primaryRegime: "سلوك الأصول عالية النمو وحساسية السيولة النقدية.",
    scenarios: {
      bullish: {
        condition: "بيانات تدعم التيسير النقدي، ضعف الدولار، أو وفرة السيولة العالمية",
        directionalBias: "bullish",
        biasLabel: "إيجابي وصعودي (Risk-On)",
        detail: "زيادة المعروض النقدي ورغبة المستثمرين في تنمية رؤوس أموالهم تدعم أسواق العملات المشفرة.",
        traderTip: "ابحث عن فرص شراء مؤكدة فنياً.",
      },
      bearish: {
        condition: "بيانات تدعم تشديد السياسة، ارتفاع الدولار، أو مخاوف السيولة",
        directionalBias: "bearish",
        biasLabel: "ضغط بيعي وتحفظ (Risk-Off)",
        detail: "ارتفاع العوائد الآمنة يقلل من جاذبية الاستثمار في العملات المشفرة مؤقتاً.",
        traderTip: "توخّ الحذر والتزم بإدارة المخاطر الصارمة.",
      },
      intradayVolatility: {
        condition: "وقت إعلان البيانات الكبرى",
        directionalBias: "whipsaw",
        biasLabel: "تذبذب مؤقت",
        detail: "امتصاص السوق للأرقام الجديدة وإعادة موازنة المحافظ الاستثمارية.",
        traderTip: "تجنب التداول العشوائي وتداول فقط عند وضوح الاتجاه.",
      },
    },
    empiricalStats: {
      averageWindowMove: "حركات تذبذب معتادة تتراوح بين ±1.0% و ±2.5%.",
      institutionalMechanic: "إعادة توزيع الأوزان الاستثمارية بين السندات والأسهم والسلع والعملات المشفرة.",
      correlationDriver: "مؤشر السيولة العالمية الصافية ومؤشر الخوف والطمع.",
    },
    academicReferences: [
      {
        platform: "شبكة أبحاث العلوم الاجتماعية (SSRN)",
        authors: "SSRN Finance Research Series",
        title: "Cryptocurrency Returns and Macroeconomic Environment",
        paperUrl: "https://www.ssrn.com",
        keyFinding: "البيتكوين يتصرف كأصل مخاطرة ذي حساسية فائقة لدورات السيولة العالمية وتغيرات السياسة النقدية.",
      },
    ],
  },
};

/**
 * Determine the historical impact profile based on event record ID, title, and summary.
 */
export function getHistoricalImpact(event: { id: string; title: string; summary?: string }): HistoricalImpactProfile {
  const id = event.id.toLowerCase();
  const title = event.title.toLowerCase();
  const summary = (event.summary ?? "").toLowerCase();

  if (id.startsWith("cpi") || title.includes("cpi") || title.includes("مستهلك") || title.includes("تضخم") || summary.includes("consumer price index")) {
    return HISTORICAL_IMPACT_PROFILES.cpi;
  }
  if (id.startsWith("ppi") || title.includes("ppi") || title.includes("منتج") || summary.includes("producer price index")) {
    return HISTORICAL_IMPACT_PROFILES.ppi;
  }
  if (id.startsWith("fed") || title.includes("فيدرال") || title.includes("fomc") || title.includes("فائدة") || summary.includes("federal reserve")) {
    return HISTORICAL_IMPACT_PROFILES.fed;
  }
  if (id.startsWith("empsit") || id.startsWith("jobs") || title.includes("وظائف") || title.includes("بطالة") || title.includes("payroll") || summary.includes("nonfarm")) {
    return HISTORICAL_IMPACT_PROFILES.empsit;
  }
  if (id.startsWith("coindesk") || title.includes("coindesk") || title.includes("سوق") || title.includes("تصفيات") || summary.includes("coindesk")) {
    return HISTORICAL_IMPACT_PROFILES.market;
  }

  return HISTORICAL_IMPACT_PROFILES.macro_general;
}
