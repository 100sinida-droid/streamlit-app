// 한국 거래소 전체 종목 데이터 (KOSPI + KOSDAQ)
// 대소문자 구분 없이 검색 가능
const koreaStocks = [
    // === KOSPI 대형주 ===
    { name: "삼성전자", ticker: "005930.KS", search: "삼성전자 samsung electronics 005930" },
    { name: "SK하이닉스", ticker: "000660.KS", search: "sk하이닉스 skhynix hynix 000660" },
    { name: "LG에너지솔루션", ticker: "373220.KS", search: "lg에너지솔루션 lges lgenerysolution 373220" },
    { name: "삼성바이오로직스", ticker: "207940.KS", search: "삼성바이오로직스 삼바 samsungbiologics 207940" },
    { name: "삼성SDI", ticker: "006400.KS", search: "삼성sdi samsungsdi 006400" },
    { name: "현대차", ticker: "005380.KS", search: "현대차 현대자동차 hyundai motor 005380" },
    { name: "기아", ticker: "000270.KS", search: "기아 kia 000270" },
    { name: "NAVER", ticker: "035420.KS", search: "네이버 naver 035420" },
    { name: "카카오", ticker: "035720.KS", search: "카카오 kakao 035720" },
    { name: "셀트리온", ticker: "068270.KS", search: "셀트리온 celltrion 068270" },
    { name: "LG화학", ticker: "051910.KS", search: "lg화학 lgchem lgchemical 051910" },
    { name: "POSCO홀딩스", ticker: "005490.KS", search: "포스코 posco 005490" },
    { name: "KB금융", ticker: "105560.KS", search: "kb금융 kbbank kbfinancial 105560" },
    { name: "신한지주", ticker: "055550.KS", search: "신한지주 신한은행 shinhan 055550" },
    { name: "하나금융지주", ticker: "086790.KS", search: "하나금융 하나은행 hana 086790" },
    
    // === 이건 계열 추가 ===
    { name: "이건홀딩스", ticker: "003010.KS", search: "이건홀딩스 ekoenholdings 003010" },
    { name: "이건산업", ticker: "008250.KS", search: "이건산업 ekoen 008250" },
    
    // === 운송/해운 ===
    { name: "HMM", ticker: "011200.KS", search: "hmm 현대상선 hyundaimm 011200" },
    { name: "대한항공", ticker: "003490.KS", search: "대한항공 koreanair kal 003490" },
    { name: "아시아나항공", ticker: "020560.KS", search: "아시아나항공 asiana 020560" },
    { name: "팬오션", ticker: "028670.KS", search: "팬오션 panocean 028670" },
    { name: "흥아해운", ticker: "003280.KS", search: "흥아해운 heungareshipping 003280" },
    
    // === 전자/IT ===
    { name: "LG전자", ticker: "066570.KS", search: "lg전자 lge lgelectronics 066570" },
    { name: "삼성전기", ticker: "009150.KS", search: "삼성전기 samsungem 009150" },
    { name: "LG디스플레이", ticker: "034220.KS", search: "lg디스플레이 lgdisplay 034220" },
    { name: "SK스퀘어", ticker: "402340.KS", search: "sk스퀘어 sksquare 402340" },
    { name: "SK텔레콤", ticker: "017670.KS", search: "sk텔레콤 skt sktelecom 017670" },
    { name: "KT", ticker: "030200.KS", search: "kt 케이티 030200" },
    { name: "LG유플러스", ticker: "032640.KS", search: "lg유플러스 lguplus lgu+ 032640" },
    
    // === 금융 ===
    { name: "삼성생명", ticker: "032830.KS", search: "삼성생명 samsunglife 032830" },
    { name: "삼성화재", ticker: "000810.KS", search: "삼성화재 samsungfire 000810" },
    { name: "삼성증권", ticker: "016360.KS", search: "삼성증권 samsungsecurities 016360" },
    { name: "우리금융지주", ticker: "316140.KS", search: "우리금융 우리은행 woori 316140" },
    { name: "메리츠금융지주", ticker: "138040.KS", search: "메리츠금융 meritz 138040" },
    { name: "미래에셋증권", ticker: "006800.KS", search: "미래에셋증권 miraeasset 006800" },
    { name: "한국금융지주", ticker: "071050.KS", search: "한국금융지주 bnkfg 071050" },
    { name: "JB금융지주", ticker: "175330.KS", search: "jb금융 jbfg 175330" },
    
    // === 에너지/화학 ===
    { name: "SK이노베이션", ticker: "096770.KS", search: "sk이노베이션 skinnovation 096770" },
    { name: "LG", ticker: "003550.KS", search: "lg 003550" },
    { name: "롯데케미칼", ticker: "011170.KS", search: "롯데케미칼 lottechemical 011170" },
    { name: "한화솔루션", ticker: "009830.KS", search: "한화솔루션 hanwhasolution 009830" },
    { name: "S-Oil", ticker: "010950.KS", search: "에스오일 soil 010950" },
    { name: "GS", ticker: "078930.KS", search: "gs 078930" },
    { name: "SK가스", ticker: "018670.KS", search: "sk가스 skgas 018670" },
    { name: "한국전력", ticker: "015760.KS", search: "한국전력 한전 kepco 015760" },
    { name: "SK에너지", ticker: "096770.KS", search: "sk에너지 skenergy 096770" },
    { name: "GS칼텍스", ticker: "078930.KS", search: "gs칼텍스 gscaltex 078930" },
    
    // === 건설/중공업 ===
    { name: "삼성물산", ticker: "028260.KS", search: "삼성물산 samsungcnt 028260" },
    { name: "삼성엔지니어링", ticker: "028050.KS", search: "삼성엔지니어링 samsungeng 028050" },
    { name: "현대건설", ticker: "000720.KS", search: "현대건설 hyundaienc 000720" },
    { name: "GS건설", ticker: "006360.KS", search: "gs건설 gsenc 006360" },
    { name: "대림산업", ticker: "000210.KS", search: "대림산업 daelim 000210" },
    { name: "대우건설", ticker: "047040.KS", search: "대우건설 daewooenc 047040" },
    { name: "HD현대", ticker: "267250.KS", search: "hd현대 hdhyundai 267250" },
    { name: "HD한국조선해양", ticker: "009540.KS", search: "hd한국조선 조선 hdhhi 009540" },
    { name: "두산에너빌리티", ticker: "034020.KS", search: "두산에너빌리티 doosan 034020" },
    { name: "두산밥캣", ticker: "241560.KS", search: "두산밥캣 doosanbobcat 241560" },
    { name: "HD현대중공업", ticker: "329180.KS", search: "hd현대중공업 329180" },
    { name: "한화에어로스페이스", ticker: "012450.KS", search: "한화에어로스페이스 hanwhaaerospace 012450" },
    { name: "대우조선해양", ticker: "042660.KS", search: "대우조선해양 dsme 042660" },
    { name: "현대미포조선", ticker: "010620.KS", search: "현대미포조선 hmd 010620" },
    
    // === 철강/소재 ===
    { name: "포스코퓨처엠", ticker: "003670.KS", search: "포스코퓨처엠 poscofuturem 003670" },
    { name: "고려아연", ticker: "010130.KS", search: "고려아연 koreazinc 010130" },
    { name: "현대제철", ticker: "004020.KS", search: "현대제철 hyundaisteel 004020" },
    { name: "동국제강", ticker: "001230.KS", search: "동국제강 dongkuksteel 001230" },
    { name: "POSCO", ticker: "005490.KS", search: "포스코 posco 005490" },
    { name: "세아베스틸", ticker: "001430.KS", search: "세아베스틸 seahbesteel 001430" },
    
    // === 자동차/부품 ===
    { name: "현대모비스", ticker: "012330.KS", search: "현대모비스 mobis 012330" },
    { name: "현대위아", ticker: "011210.KS", search: "현대위아 hyundaiwia 011210" },
    { name: "만도", ticker: "204320.KS", search: "만도 mando 204320" },
    { name: "한온시스템", ticker: "018880.KS", search: "한온시스템 hanon 018880" },
    { name: "현대트랜시스", ticker: "078350.KS", search: "현대트랜시스 transys 078350" },
    
    // === 유통/식품 ===
    { name: "이마트", ticker: "139480.KS", search: "이마트 emart 139480" },
    { name: "롯데쇼핑", ticker: "023530.KS", search: "롯데쇼핑 lotteshopping 023530" },
    { name: "신세계", ticker: "004170.KS", search: "신세계 shinsegae 004170" },
    { name: "CJ제일제당", ticker: "097950.KS", search: "cj제일제당 cjcheiljedang 097950" },
    { name: "오리온", ticker: "271560.KS", search: "오리온 orion 271560" },
    { name: "농심", ticker: "004370.KS", search: "농심 nongshim 004370" },
    { name: "SPC삼립", ticker: "005610.KS", search: "spc삼립 spcsamlip 005610" },
    { name: "하이트진로", ticker: "000080.KS", search: "하이트진로 hitejinro 000080" },
    { name: "롯데칠성", ticker: "005300.KS", search: "롯데칠성 lottechilsung 005300" },
    { name: "롯데제과", ticker: "280360.KS", search: "롯데제과 lotteconf 280360" },
    { name: "CJ", ticker: "001040.KS", search: "cj 001040" },
    { name: "CJ대한통운", ticker: "000120.KS", search: "cj대한통운 cjlogistics 000120" },
    
    // === 제약/바이오 ===
    { name: "삼성바이오에피스", ticker: "207940.KS", search: "삼성바이오에피스 biosimilar 207940" },
    { name: "셀트리온헬스케어", ticker: "091990.KS", search: "셀트리온헬스케어 celltrionhc 091990" },
    { name: "셀트리온제약", ticker: "068760.KS", search: "셀트리온제약 celltrionpharm 068760" },
    { name: "유한양행", ticker: "000100.KS", search: "유한양행 yuhan 000100" },
    { name: "종근당", ticker: "185750.KS", search: "종근당 chongkundang 185750" },
    { name: "녹십자", ticker: "006280.KS", search: "녹십자 greencross 006280" },
    { name: "한미약품", ticker: "128940.KS", search: "한미약품 hanmipharm 128940" },
    { name: "대웅제약", ticker: "069620.KS", search: "대웅제약 daewoongpharm 069620" },
    { name: "JW중외제약", ticker: "001060.KS", search: "jw중외제약 jwpharm 001060" },
    { name: "신풍제약", ticker: "019170.KS", search: "신풍제약 shinpoong 019170" },
    { name: "동아에스티", ticker: "170900.KS", search: "동아에스티 dongast 170900" },
    { name: "보령제약", ticker: "003850.KS", search: "보령제약 boryung 003850" },
    { name: "유유제약", ticker: "000220.KS", search: "유유제약 yuyu 000220" },
    
    // === 화장품 ===
    { name: "아모레퍼시픽", ticker: "090430.KS", search: "아모레퍼시픽 amorepacific 090430" },
    { name: "LG생활건강", ticker: "051900.KS", search: "lg생활건강 lghhb 051900" },
    { name: "코스맥스", ticker: "192820.KS", search: "코스맥스 cosmax 192820" },
    { name: "아모레G", ticker: "002790.KS", search: "아모레g amoreg 002790" },
    
    // === SK 계열 ===
    { name: "SK", ticker: "034730.KS", search: "sk 034730" },
    { name: "SK케미칼", ticker: "285130.KS", search: "sk케미칼 skchemical 285130" },
    { name: "SK바이오사이언스", ticker: "302440.KS", search: "sk바이오사이언스 skbioscience 302440" },
    { name: "SK바이오팜", ticker: "326030.KS", search: "sk바이오팜 skbiopharm 326030" },
    { name: "SK네트웍스", ticker: "001740.KS", search: "sk네트웍스 sknetworks 001740" },
    { name: "SK아이이테크놀로지", ticker: "361610.KS", search: "sk아이이테크놀로지 skiet 361610" },
    { name: "SK실트론", ticker: "222800.KS", search: "sk실트론 sksiltron 222800" },
    { name: "SK디스커버리", ticker: "006120.KS", search: "sk디스커버리 skdiscovery 006120" },
    
    // === LG 계열 ===
    { name: "LG이노텍", ticker: "011070.KS", search: "lg이노텍 lginnotek 011070" },
    { name: "LG CNS", ticker: "068870.KS", search: "lg cns lgcns 068870" },
    { name: "LG하우시스", ticker: "108670.KS", search: "lg하우시스 lghausys 108670" },
    
    // === 현대 계열 ===
    { name: "현대글로비스", ticker: "086280.KS", search: "현대글로비스 hyundaiglovis 086280" },
    { name: "현대백화점", ticker: "069960.KS", search: "현대백화점 hyundaidept 069960" },
    { name: "현대홈쇼핑", ticker: "057050.KS", search: "현대홈쇼핑 hyundaihome 057050" },
    { name: "현대리바트", ticker: "079430.KS", search: "현대리바트 livart 079430" },
    { name: "현대오일뱅크", ticker: "010620.KS", search: "현대오일뱅크 hob 010620" },
    
    // === 신재생에너지 ===
    { name: "OCI", ticker: "010060.KS", search: "oci 010060" },
    { name: "한화", ticker: "000880.KS", search: "한화 hanwha 000880" },
    { name: "LS", ticker: "006260.KS", search: "ls 006260" },
    { name: "LS전선", ticker: "011070.KS", search: "ls전선 lscable 011070" },
    
    // === 증권/자산운용 ===
    { name: "NH투자증권", ticker: "005940.KS", search: "nh투자증권 nhinvestment 005940" },
    { name: "한국투자증권", ticker: "030200.KS", search: "한국투자증권 koreainvestment 030200" },
    { name: "키움증권", ticker: "039490.KQ", search: "키움증권 kiwoom 039490" },
    
    // === 보험 ===
    { name: "DB손해보험", ticker: "005830.KS", search: "db손해보험 dbinsurance 005830" },
    { name: "한화생명", ticker: "088350.KS", search: "한화생명 hanwhalife 088350" },
    { name: "교보생명", ticker: "082640.KS", search: "교보생명 kyobolife 082640" },
    
    // === 건설 추가 ===
    { name: "SK에코플랜트", ticker: "028050.KS", search: "sk에코플랜트 skecoplant 028050" },
    { name: "포스코건설", ticker: "028050.KS", search: "포스코건설 poscoenc 028050" },
    { name: "HDC현대산업개발", ticker: "294870.KS", search: "hdc현대산업개발 hdc 294870" },
    
    // === 통신/미디어 ===
    { name: "KT&G", ticker: "033780.KS", search: "ktg 케이티지 033780" },
    { name: "LG헬로비전", ticker: "037560.KS", search: "lg헬로비전 lghello 037560" },
    { name: "CJ CGV", ticker: "079160.KS", search: "cj cgv 079160" },
    
    // === 여행/레저 ===
    { name: "호텔신라", ticker: "008770.KS", search: "호텔신라 hotelshilla 008770" },
    { name: "파라다이스", ticker: "034230.KS", search: "파라다이스 paradise 034230" },
    { name: "GKL", ticker: "114090.KS", search: "gkl 114090" },
    
    // === 물류 ===
    { name: "한진", ticker: "002320.KS", search: "한진 hanjin 002320" },
    { name: "롯데글로벌로지스", ticker: "086280.KS", search: "롯데글로벌로지스 lottelogistics 086280" },
    
    // === 렌탈/서비스 ===
    { name: "코웨이", ticker: "021240.KS", search: "코웨이 coway 021240" },
    { name: "SK렌터카", ticker: "068400.KS", search: "sk렌터카 skrentacar 068400" },
    
    // === 패션/의류 ===
    { name: "F&F", ticker: "383220.KS", search: "에프앤에프 fnf mlb 383220" },
    { name: "한세실업", ticker: "105630.KS", search: "한세실업 hansae 105630" },
    { name: "영원무역", ticker: "111770.KS", search: "영원무역 youngone 111770" },
    
    // === 농업/식품 추가 ===
    { name: "대상", ticker: "001680.KS", search: "대상 daesang 001680" },
    { name: "사조대림", ticker: "003960.KS", search: "사조대림 sajodaelim 003960" },
    { name: "오뚜기", ticker: "007310.KS", search: "오뚜기 ottogi 007310" },
    { name: "삼양식품", ticker: "003230.KS", search: "삼양식품 samyangfood 003230" },
    
    // === 펄프/제지 ===
    { name: "한솔제지", ticker: "002100.KS", search: "한솔제지 hansolpaper 002100" },
    { name: "무림P&P", ticker: "009580.KS", search: "무림 moorim 009580" },
    
    // === 섬유 ===
    { name: "효성", ticker: "004800.KS", search: "효성 hyosung 004800" },
    { name: "코오롱인더", ticker: "120110.KS", search: "코오롱인더 kolonind 120110" },
    
    // === 기계 ===
    { name: "두산퓨얼셀", ticker: "336260.KS", search: "두산퓨얼셀 doosanfuelcell 336260" },
    
    // ======================================
    // === KOSDAQ 종목들 ===
    // ======================================
    
    // === KOSDAQ 대형주 ===
    { name: "에코프로비엠", ticker: "247540.KQ", search: "에코프로비엠 ecoprobm 247540" },
    { name: "에코프로", ticker: "086520.KQ", search: "에코프로 ecopro 086520" },
    { name: "엘앤에프", ticker: "066970.KQ", search: "엘앤에프 lnf 066970" },
    { name: "알테오젠", ticker: "196170.KQ", search: "알테오젠 alteogen 196170" },
    { name: "리노공업", ticker: "058470.KQ", search: "리노공업 reno 058470" },
    { name: "클래시스", ticker: "214150.KQ", search: "클래시스 classys 214150" },
    { name: "파마리서치", ticker: "214450.KQ", search: "파마리서치 pharmaresearch 214450" },
    { name: "에스에프에이", ticker: "056190.KQ", search: "에스에프에이 sfa 056190" },
    { name: "원익IPS", ticker: "240810.KQ", search: "원익ips woniks 240810" },
    { name: "HLB", ticker: "028300.KQ", search: "hlb 028300" },
    { name: "제넥신", ticker: "095700.KQ", search: "제넥신 genexine 095700" },
    { name: "파두", ticker: "352700.KQ", search: "파두 fadu 352700" },
    { name: "루닛", ticker: "328130.KQ", search: "루닛 lunit 328130" },
    { name: "위메이드", ticker: "112040.KQ", search: "위메이드 wemade 112040" },
    { name: "펄어비스", ticker: "263750.KQ", search: "펄어비스 pearlabyss 263750" },
    { name: "크래프톤", ticker: "259960.KQ", search: "크래프톤 krafton 259960" },
    { name: "카카오게임즈", ticker: "293490.KQ", search: "카카오게임즈 kakaogames 293490" },
    { name: "카카오뱅크", ticker: "323410.KQ", search: "카카오뱅크 kakaobank 323410" },
    { name: "카카오페이", ticker: "377300.KQ", search: "카카오페이 kakaopay 377300" },
    { name: "엔씨소프트", ticker: "036570.KQ", search: "엔씨소프트 ncsoft 036570" },
    { name: "넷마블", ticker: "251270.KQ", search: "넷마블 netmarble 251270" },
    { name: "컴투스", ticker: "078340.KQ", search: "컴투스 com2us 078340" },
    { name: "넥슨게임즈", ticker: "225570.KQ", search: "넥슨게임즈 nexongames 225570" },
    
    // === 반도체/디스플레이 ===
    { name: "SK머티리얼즈", ticker: "036490.KQ", search: "sk머티리얼즈 skmaterials 036490" },
    { name: "이오테크닉스", ticker: "039030.KQ", search: "이오테크닉스 eotechnics 039030" },
    { name: "테스", ticker: "095610.KQ", search: "테스 tes 095610" },
    { name: "AP시스템", ticker: "265520.KQ", search: "ap시스템 apsystems 265520" },
    { name: "테크윙", ticker: "089030.KQ", search: "테크윙 techwing 089030" },
    { name: "원익QnC", ticker: "074600.KQ", search: "원익qnc wonikqnc 074600" },
    { name: "ISC", ticker: "095340.KQ", search: "isc 095340" },
    { name: "파크시스템스", ticker: "140860.KQ", search: "파크시스템스 parksystems 140860" },
    
    // === 2차전지 ===
    { name: "천보", ticker: "278280.KQ", search: "천보 chunbo 278280" },
    { name: "코스모신소재", ticker: "005070.KQ", search: "코스모신소재 cosmo 005070" },
    { name: "후성", ticker: "093370.KQ", search: "후성 foosung 093370" },
    { name: "엔켐", ticker: "348370.KQ", search: "엔켐 enchem 348370" },
    { name: "대주전자재료", ticker: "078600.KQ", search: "대주전자재료 daejoo 078600" },
    { name: "상아프론테크", ticker: "089980.KQ", search: "상아프론테크 sangah 089980" },
    { name: "티씨케이", ticker: "064760.KQ", search: "티씨케이 tck 064760" },
    
    // === 바이오/제약 (KOSDAQ) ===
    { name: "에이비엘바이오", ticker: "298380.KQ", search: "에이비엘바이오 ablbio 298380" },
    { name: "신라젠", ticker: "215600.KQ", search: "신라젠 sillagen 215600" },
    { name: "메디톡스", ticker: "086900.KQ", search: "메디톡스 meditoxin 086900" },
    { name: "메지온", ticker: "140410.KQ", search: "메지온 medion 140410" },
    { name: "삼천당제약", ticker: "000250.KQ", search: "삼천당제약 samchundang 000250" },
    { name: "유나이티드제약", ticker: "025950.KQ", search: "유나이티드제약 united 025950" },
    { name: "차바이오텍", ticker: "085660.KQ", search: "차바이오텍 chabiotech 085660" },
    { name: "녹십자홀딩스", ticker: "005250.KQ", search: "녹십자홀딩스 greencrosshd 005250" },
    
    // === IT/소프트웨어 ===
    { name: "더존비즈온", ticker: "012510.KQ", search: "더존비즈온 douzone 012510" },
    { name: "안랩", ticker: "053800.KQ", search: "안랩 ahnlab 053800" },
    { name: "한글과컴퓨터", ticker: "030520.KQ", search: "한글과컴퓨터 hnc hancom 030520" },
    { name: "지니언스", ticker: "263860.KQ", search: "지니언스 genians 263860" },
    { name: "솔본", ticker: "035610.KQ", search: "솔본 solborn 035610" },
    { name: "다우기술", ticker: "023590.KQ", search: "다우기술 daou 023590" },
    
    // === 엔터테인먼트 ===
    { name: "하이브", ticker: "352820.KQ", search: "하이브 hybe bts 352820" },
    { name: "JYP Ent.", ticker: "035900.KQ", search: "jyp 제이와이피 035900" },
    { name: "SM", ticker: "041510.KQ", search: "sm 에스엠 041510" },
    { name: "YG PLUS", ticker: "037270.KQ", search: "yg 와이지 037270" },
    { name: "CJ ENM", ticker: "035760.KQ", search: "cjenm cj이엔엠 035760" },
    
    // === 화학/소재 (KOSDAQ) ===
    { name: "솔브레인", ticker: "357780.KQ", search: "솔브레인 soulbrain 357780" },
    { name: "덕산네오룩스", ticker: "213420.KQ", search: "덕산네오룩스 duksan 213420" },
    { name: "피에스케이", ticker: "319660.KQ", search: "피에스케이 psk 319660" },
    { name: "램테크놀러지", ticker: "171010.KQ", search: "램테크놀러지 ramtechnology 171010" },
    
    // === 기타 유망주 ===
    { name: "셀바스AI", ticker: "108860.KQ", search: "셀바스ai selvasai 108860" },
    { name: "수젠텍", ticker: "253840.KQ", search: "수젠텍 sugentech 253840" },
    { name: "씨젠", ticker: "096530.KQ", search: "씨젠 seegene 096530" },
    { name: "에이치엘비", ticker: "028300.KQ", search: "에이치엘비 hlb 028300" },
    { name: "아이센스", ticker: "099190.KQ", search: "아이센스 isense 099190" },
    { name: "레인보우로보틱스", ticker: "277810.KQ", search: "레인보우로보틱스 rainbow 277810" },
    { name: "유진로봇", ticker: "056080.KQ", search: "유진로봇 yujinrobot 056080" },
    { name: "현대로보틱스", ticker: "090710.KQ", search: "현대로보틱스 hyundairobotics 090710" },
    
    // === 교육 ===
    { name: "메가스터디교육", ticker: "215200.KQ", search: "메가스터디 megastudy 215200" },
    { name: "대교", ticker: "019680.KQ", search: "대교 daekyo 019680" },
    
    // === KOSDAQ 추가 종목 ===
    { name: "이녹스첨단소재", ticker: "272290.KQ", search: "이녹스첨단소재 inox 272290" },
    { name: "디앤씨미디어", ticker: "263720.KQ", search: "디앤씨미디어 dncmedia 263720" },
    { name: "리메드", ticker: "301290.KQ", search: "리메드 remed 301290" },
    { name: "아이패밀리에스씨", ticker: "214430.KQ", search: "아이패밀리 ifamilysc 214430" },
    { name: "에스티큐브", ticker: "052020.KQ", search: "에스티큐브 stcube 052020" },
    { name: "스튜디오드래곤", ticker: "253450.KQ", search: "스튜디오드래곤 studiodragon 253450" },
    { name: "휴맥스", ticker: "115160.KQ", search: "휴맥스 humax 115160" },
    { name: "인바디", ticker: "041830.KQ", search: "인바디 inbody 041830" },
    { name: "제이콘텐트리", ticker: "036420.KQ", search: "제이콘텐트리 jcontentree 036420" },
    { name: "실리콘투", ticker: "257720.KQ", search: "실리콘투 silicon2 257720" },
    { name: "와이지엔터테인먼트", ticker: "122870.KQ", search: "yg와이지 ygent 122870" },
    { name: "빅히트", ticker: "352820.KQ", search: "빅히트 bighit 352820" },
    { name: "텔레칩스", ticker: "054450.KQ", search: "텔레칩스 telechips 054450" },
    { name: "퓨런티어", ticker: "241770.KQ", search: "퓨런티어 furenteer 241770" },
    { name: "엑셈", ticker: "205100.KQ", search: "엑셈 exem 205100" },
    { name: "뷰노", ticker: "338220.KQ", search: "뷰노 vuno 338220" },
    { name: "씨유메디칼", ticker: "115480.KQ", search: "씨유메디칼 cumedical 115480" },
    { name: "마크로젠", ticker: "038290.KQ", search: "마크로젠 macrogen 038290" },
    { name: "나노엔텍", ticker: "240810.KQ", search: "나노엔텍 nanoentec 240810" },
    { name: "아이에스동서", ticker: "010780.KQ", search: "아이에스동서 isdongsuh 010780" },
    { name: "엑시콘", ticker: "054040.KQ", search: "엑시콘 axicon 054040" },
    { name: "디알젬", ticker: "263690.KQ", search: "디알젬 drgem 263690" },
    { name: "센트럴모텍", ticker: "308170.KQ", search: "센트럴모텍 centralmotek 308170" },
    { name: "윈스", ticker: "065500.KQ", search: "윈스 wins 065500" },
    { name: "원텍", ticker: "336570.KQ", search: "원텍 wontech 336570" },
    { name: "오스템임플란트", ticker: "048260.KQ", search: "오스템 osstem 048260" },
    { name: "바이오니아", ticker: "066980.KQ", search: "바이오니아 bioneer 066980" },
    { name: "제노포커스", ticker: "187420.KQ", search: "제노포커스 genofocus 187420" },
    { name: "레고켐바이오", ticker: "141080.KQ", search: "레고켐바이오 legochembio 141080" },
    { name: "유바이오로직스", ticker: "206650.KQ", search: "유바이오로직스 ybiologics 206650" },
    
    // === 추가 KOSPI 기업들 ===
    { name: "KT&G", ticker: "033780.KS", search: "케이티앤지 ktng 033780" },
    { name: "BGF리테일", ticker: "282330.KS", search: "bgf리테일 bgfretail cu 282330" },
    { name: "GS리테일", ticker: "007070.KS", search: "gs리테일 gsretail 007070" },
    { name: "신세계푸드", ticker: "031440.KS", search: "신세계푸드 shinsegaefood 031440" },
    { name: "BNK금융지주", ticker: "138930.KS", search: "bnk금융 bnkfg 138930" },
    { name: "DGB금융지주", ticker: "139130.KS", search: "dgb금융 dgbfg 139130" },
    { name: "BS금융지주", ticker: "138930.KS", search: "bs금융 bsfg 138930" },
    { name: "삼성중공업", ticker: "010140.KS", search: "삼성중공업 samsungheavy 010140" },
    { name: "S&T모티브", ticker: "064960.KS", search: "에스앤티모티브 stmotive 064960" },
    { name: "현대중공업지주", ticker: "267250.KS", search: "현대중공업지주 hdhihd 267250" },
    { name: "DB하이텍", ticker: "000990.KS", search: "db하이텍 dbhitek 000990" },
    { name: "한국타이어", ticker: "161390.KS", search: "한국타이어 hankooktire 161390" },
    { name: "금호타이어", ticker: "073240.KS", search: "금호타이어 kumhotire 073240" },
    { name: "넥센타이어", ticker: "002350.KS", search: "넥센타이어 nexentire 002350" },
    { name: "한국항공우주", ticker: "047810.KS", search: "한국항공우주 kai 047810" },
    { name: "LIG넥스원", ticker: "079550.KS", search: "lig넥스원 lignex1 079550" },
    { name: "풍산", ticker: "103140.KS", search: "풍산 poongsan 103140" },
    { name: "한화시스템", ticker: "272210.KS", search: "한화시스템 hanwhasystems 272210" },
    { name: "STX조선해양", ticker: "067250.KS", search: "stx조선해양 stxshipbuilding 067250" },
    { name: "성신양회", ticker: "004980.KS", search: "성신양회 sungshin 004980" },
    { name: "쌍용C&E", ticker: "003410.KS", search: "쌍용ce ssangyong 003410" },
    { name: "한일시멘트", ticker: "300720.KS", search: "한일시멘트 hanilcement 300720" },
];
