# Theo dõi nguồn lead Victoria

## Các phần đã chuẩn bị

- `index.html` và `assets/lead-attribution.js`: đọc UTM, tên/ID chiến dịch, nhóm quảng cáo, quảng cáo và mã click.
- Lưu nguồn đầu tiên và nguồn xác định gần nhất trong cùng trình duyệt, cùng origin. Thời hạn 30 ngày tính từ lần nhận diện nguồn gần nhất. Lượt quay lại không có nguồn không gia hạn hay xóa nguồn đã biết.
- Google Apps Script: ghi theo tên cột thực tế, chỉ thêm cột thiếu, giữ nguyên vị trí cột cũ và dữ liệu sales. Không lưu tên/SĐT trong bộ nhớ attribution của trình duyệt.
- Meta giữ lời gọi `Lead` và custom `SubmitForm`; TikTok giữ lời gọi `SubmitForm`. Attribution không tự cài thêm Pixel hay Events API.

## Mẫu cho Meta

Dán chuỗi sau vào trường URL parameters ở cấp quảng cáo, không thêm dấu `?` ở đầu. Nếu đã có tham số, hợp nhất và tránh trùng khóa.

```text
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}
```

Kiểm tra bằng lượt bấm từ quảng cáo thực tế: tên/ID phải được thay thành giá trị thật, không còn `{{...}}`. Tên có thể là tên lúc đăng quảng cáo, nên dùng ID để đối chiếu chắc chắn.

## Mẫu cho TikTok

Dùng URL builder của TikTok để thêm các tham số dưới đây vào URL đích. Mẫu Meta không dùng được cho TikTok.

TikTok thông thường:

```text
utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__&utm_term=__AID_NAME__&campaign_id=__CAMPAIGN_ID__&adset_id=__AID__&ad_id=__CID__&placement=__PLACEMENT__
```

Trong mẫu thông thường, `ad_id` lưu **creative ID** của TikTok, tức mã nội dung, không phải ID bundle của Smart+.

Upgraded Smart+:

```text
utm_source=tiktok&utm_medium=paid_social&utm_campaign=__CAMPAIGN_NAME__&utm_content=__CID_NAME__&utm_term=__AID_NAME__&campaign_id=__CAMPAIGN_ID__&adset_id=__AID__&ad_id=__ADID_V2__&ad_name=__ADID_V2_NAME__&placement=__PLACEMENT__
```

Xác nhận trong URL builder các macro được loại chiến dịch đang dùng hỗ trợ. Không đăng một URL còn macro chưa được thay thế.

## Link organic

Mỗi bài thay `utm_content` bằng tên riêng, không dấu và không khoảng trắng.

```text
https://www.victoriafitness.vn/?utm_source=facebook&utm_medium=organic_social&utm_campaign=thang11&utm_content=bai_duong_bang
https://www.victoriafitness.vn/?utm_source=instagram&utm_medium=organic_social&utm_campaign=bio&utm_content=link_in_bio
https://www.victoriafitness.vn/?utm_source=zalo&utm_medium=organic_social&utm_campaign=tu_van&utm_content=oa_victoria
```

## Đọc kết quả trong Sheet

Tab `Leads` giữ các cột K:O cho UTM. Các cột mới từ AF trở đi:

- `source_label`, `traffic_type`: tên nguồn và phân loại.
- `campaign_name` / `campaign_id`: chiến dịch.
- `adset_name` / `adset_id`: nhóm quảng cáo.
- `ad_name` / `ad_id`: quảng cáo hoặc mã nội dung theo mẫu TikTok phía trên.
- `first_*`: nguồn đầu tiên trong khoảng lưu trữ; có thể là `unknown`.
- `last_*`: nguồn xác định gần nhất. Các cột UTM chính cũng dùng nguồn này.

`fbclid` một mình không chứng minh khách đến từ ads. Referrer Facebook/Instagram chỉ xác nhận có link giới thiệu, chưa phân biệt paid/organic. Không có thông tin thì lưu `unknown`, không tự gán organic.

Thông tin nguồn từ link có thể được sao chép/chia sẻ, nên phản ánh đường link đã dùng; không chứng minh khách đã xem một quảng cáo cụ thể. Không thể giữ nguồn xuyên thiết bị hoặc sau khi khách xóa bộ nhớ trình duyệt.

## Phát hành và kiểm tra

1. Cloudflare: upload **nội dung `dist/`** với `index.html` tại gốc và thư mục `assets/`. Không chỉ upload riêng HTML vì tracker nằm trong assets.
2. Apps Script dùng URL webhook hiện có. Khi cập nhật mã, chỉnh deployment hiện có sang phiên bản mới để giữ nguyên URL và quyền truy cập. `setupLeadTracking` chỉ bổ sung header, không tạo lead và không gửi Telegram.
3. Gắn UTM vào ads và link organic. Chỉ đổi code website sẽ không tự bổ sung tên quảng cáo vào những link không có nhãn.
4. Dùng lead test để kiểm tra nguồn, tên/ID ads, rồi quay lại bằng link không có query trên cùng trình duyệt và kiểm tra nguồn vẫn được giữ.

Form hiện dùng `fetch` với `mode: no-cors` theo source cũ: trình duyệt không đọc được xác nhận ghi Sheet từ server. Kiểm tra dòng trong Sheet là bước xác nhận cuối; thông báo thành công trên giao diện tự nó không chứng minh Sheet đã ghi xong.

Kiểm tra tự động: `node --test tests/lead-attribution.test.cjs` (18 trường hợp).

Tham khảo: https://ads.tiktok.com/resources/help/article/track-offsite-web-events-with-utm-parameters
