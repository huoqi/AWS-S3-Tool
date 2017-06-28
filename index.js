// force path style to avoid CORS block.
AWS.config.s3ForcePathStyle = true;

const ToolURLMap = {
  'CN': {
    'ToolURL': 'https://s3.cn-north-1.amazonaws.com.cn/aws-s3-tool.cn.xinjian.io/index.html',
    'Domain': 'aws-s3-tool.cn.xinjian.io',
    'S3Base': 'https://s3.cn-north-1.amazonaws.com.cn'
  },
  'Global': {
    'ToolURL': 'https://s3.amazonaws.com/aws-s3-tool.xinjian.io/index.html',
    'Domain': 'aws-s3-tool.xinjian.io',
    'S3Base': 'https://s3.amazonaws.com'
  }
};

const CORSRule = ['Please configure your S3 CORS Configuration. Such as:',
  '',
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<CORSConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">',
  '<CORSRule>',
  '  <AllowedOrigin>https://s3.amazonaws.com</AllowedOrigin>',
  '  <AllowedMethod>GET</AllowedMethod>',
  '  <AllowedMethod>PUT</AllowedMethod>',
  '  <AllowedMethod>DELETE</AllowedMethod>',
  '  <MaxAgeSeconds>3000</MaxAgeSeconds>',
  '  <AllowedHeader>*</AllowedHeader>',
  '</CORSRule>',
  '</CORSConfiguration>'
].join('\n');

var region;
var PATH;

//redirect to S3 url
if (location.host === ToolURLMap.CN.Domain) {
  location.href = ToolURLMap.CN.ToolURL;
  throw SyntaxError();
} else if (location.host === ToolURLMap.Global.Domain){
  location.href = ToolURLMap.Global.ToolURL;
  throw SyntaxError();
} else if (location.href.indexOf(ToolURLMap.CN.ToolURL) > -1) {
  region = 'cn-north-1';
} else if (location.href.indexOf(ToolURLMap.Global.ToolURL) > -1) {
  region = 'us-east-1';
} else if (location.hostname !== 'localhost' && location.protocol !== 'file:') {
  location.href = ToolURLMap.Global.ToolURL;
}

jQuery(document).ready(function($) {
  let bucketArea = $('#buckets_list').parent().parent();
  let objectArea = $('#objects_list').parent().parent();

  resizeWindow(bucketArea, objectArea);

  $(window).resize(function() {
    resizeWindow(bucketArea, objectArea);
  });

  if (region === 'us-east-1') {
    // set region.
    $('#select_regions').val(region);
  }

  if (localStorage.getItem('remember') === 'true') {
    document.getElementById('remember').checked = true;
  }

  var aKey = localStorage.getItem('accessKey');
  var sKey = localStorage.getItem('secretAccessKey');
  if (aKey == undefined) aKey = '';
  if (sKey == undefined) sKey = '';
  $('#accessKey').val(aKey);
  $('#secretAccessKey').val(sKey);
  if (aKey == '' || sKey == '') {
    $('#key').show();
  } else if (location.origin === ToolURLMap.CN.S3Base || location.origin === ToolURLMap.Global.S3Base) {
    $('#key').hide();
    updateCredentials(aKey, sKey);
    listBuckets(region);
  }

  PATH = $('#path');

  $('#select_regions').select2({
    placeholder: "Select An AWS Region",
    allowClear: false
  })
  .on('change', function() {
    if($(this).val() === 'cn-north-1') {
      location.href = ToolURLMap.CN.ToolURL;
    } else {
      location.href = ToolURLMap.Global.ToolURL;
    }
  });

  $('#select_acl').select2({
    placeholder: "Select ACL",
    allowClear: false
  });

  $('#btn_key').click(function() {
    let aKey = $('#accessKey').val();
    let sKey = $('#secretAccessKey').val();
    $.trim(aKey);
    $.trim(sKey);
    if (aKey != '' && sKey != '') {
      updateCredentials(aKey, sKey);
      $("#key").hide(400);
      let remember = document.getElementById('remember').checked;
      if (remember === true) {
        localStorage.setItem('accessKey', aKey);
        localStorage.setItem('secretAccessKey', sKey);
        localStorage.setItem('remember', true);
      } else {
        localStorage.clear();
      }
      updateEndpoint(region);
      listBuckets(region);
    }
  });

  $('#select_regions').on('select2-selecting', function(event) {
    region = event.val;
  });

  $('#list_buckets').click(function() {
    listBuckets(region);
  });

  $('#btn_list_object').click(function() {
    var bucket = $('#input_bucket').val();
    if (bucket != '') {
      loading();
      pageListObjects(bucket, '');
    }
  });

  $('#create_bucket').click(function() {
    let bucket = $('#input_new_bucket').val();
    let params = { Bucket: bucket };

    if (bucket !== '') {
      if (region !== 'cn-north-1') {
        region = 'us-east-1';
      } else {
        params['CreateBucketConfiguration'] = { LocationConstraint: region }
      }
      AWS.config.region = region;
      let s3 = new AWS.S3();

      loading();
      s3.createBucket(params, function(err, data) {
        if (err) {
          alert(err);
          loaded();
        } else {
          setCacheBucketLocation(bucket, region);
          listBuckets();
          loaded();
        }
      })
    }
  });

  $('#create_folder').click(function() {
    var bucket = PATH.attr('bucket');
    var dir = PATH.attr('dir');
    var folder = $('#input_new_folder').val();
    if (bucket !== '' && folder !== '') {
      loading();
      AWS.config.region = region;
      var s3 = new AWS.S3();
      var params = {
        Bucket: bucket,
        Key: dir + folder + '/'
      };
      s3.putObject(params, function(err, data) {
        if (err) {
          alert(err);
          loaded();
        } else {
          pageListObjects(bucket, dir);
          $('#input_new_folder').val('');
        }
      });
    }
  });

  $('#upload_files').click(function() {
    let bucket = PATH.attr('bucket');
    if (bucket === '') {
      alert('Please Select A Bucket!');
      return;
    }
    let dir = PATH.attr('dir');
    let files = document.getElementById('input_files').files; //$('#input_files');
    if (files === '') {
      alert('Please Select Files!');
      return;
    };
    let acl = $('#select_acl').val();
    let storageClass = $('input[name="storage_class"]:checked').val();
    let figure_content = $('input[name="content_type"]:checked').val();
    let encryption = '';
    if (document.getElementById('encryption').checked) {
      encryption = 'AES256';
    };
    let n = 0,
      filesSize = 0,
      endTime, useTime;
    let startTime = (new Date()).getTime();

    for (let i = 0; i < files.length; i++) {
      let file = files[i];
      let blob = new Blob([file]);
      let params = {
        Bucket: bucket,
        Key: dir + files[i].name,
        ACL: acl,
        Body: blob,
        ContentLength: file.size,
        StorageClass: storageClass
      };
      if (figure_content == 'auto') {
        params.ContentType = file.type;
      }
      if (encryption != '') {
        params.ServerSideEncryption = encryption;
      }

      loading();
      AWS.config.region = region;
      let s3 = new AWS.S3();

      filesSize += file.size;
      s3.putObject(params, function(err, data) {
        if (err) {
          console.error('Uploading objects error:', err);
          if (err.code === 'NetworkingError' && (err.region !== 'us-eat-1' || err.region !== 'cn-north-1')) {
            alert(CORSRule);
          } else {
            alert(err);
          }
          return;
        } else {
          endTime = (new Date()).getTime();
          pageListObjects(bucket, dir);
          if (++n === files.length) {
            loaded();
            useTime = (endTime - startTime) / 1000;
            speed = formatFileSize(filesSize / useTime) + '/s';
            useTime.toFixed(3);
            alert(files.length + ' file(s) has been uploaded!\nTotal Files Size: ' + formatFileSize(filesSize) +
              '\nUsed ' + useTime + 's\nAverage upload speed: ' + speed);
          }
        }
      });
    }
  });
});

function resizeWindow(bucketArea, objectArea) {
  let height = 399;
  if (window.innerHeight > 619) {
    height = window.innerHeight - 220;
  }
  bucketArea.css('height', height);
  objectArea.css('height', height);
}

function updateEndpoint(r) {
  if (typeof(r) === 'undefined') {
    r = $('#select_regions').val();
  }
  region = r;
  AWS.config.region = r;
}

function updateCredentials(accesskey, secrectKey) {
  AWS.config.update({
    accessKeyId: accesskey,
    secretAccessKey: secrectKey
  });
}

function listBuckets() {
  updateEndpoint(region);
  let s3 = new AWS.S3();

  loading();
  s3.listBuckets(function(err, data) {
    let bucketsListArea = $('#buckets_list');
    if (err) alert(err);
    else {
      let source = $("#bucket-template").html();
      let template = Handlebars.compile(source);
      bucketsListArea.html(template(data));
    }

    loaded();

    bucketsListArea.find('tr').click(function (e) {
      let bucketName = e.target.id.replace(/^bucket-/, '');
      pageListObjects(bucketName);
    });

    $.each(data.Buckets, function(index, val) {
      getAllBucketsLocation(s3, val.Name);
    })
  });
}

function getAllBucketsLocation(s3, bucketName) {
  let region = getCacheBucketLocation(bucketName);
  if (region) {
    $("#bucket-location-" + bucketName.replace(/\./g, '_')).html(region.toUpperCase());
  } else {
    s3.getBucketLocation({Bucket: bucketName}, function (err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else {
        let region = data.LocationConstraint;
        if (!region) region = 'us-east-1'
        $("#bucket-location-" + bucketName.replace(/\./g, '_')).html(region.toUpperCase());
        setCacheBucketLocation(bucketName, region);
      }
    });
  }
}

function pageListObjects(bucket, prefix = '', nextContinuationToken = null) {
  let r = getCacheBucketLocation(bucket);
  updateEndpoint(r);
  let s3 = new AWS.S3();
  let params = {
    Bucket: bucket,
    Delimiter: '/',
    Prefix: prefix,
    MaxKeys: 100,
    ContinuationToken: nextContinuationToken
  };

  loading();
  s3.listObjectsV2(params, function (err, data) {
    if (err) {
      console.error('Listing objects error:', err);
      if (err.code === 'NetworkingError' && (err.region !== 'us-eat-1' || err.region !== 'cn-north-1')) {
        alert(CORSRule);
      } else {
        alert(err);
      }
    } else {
      showPath(params.Bucket, params.Prefix);

      data['URLBase'] = s3.endpoint.href + params.Bucket + '/';
      data['Prefix'] = prefix;

      let objectsListArea = $('#objects_list');
      if (nextContinuationToken === null) {
        objectsListArea.html('');
      }

      let source = $("#object-template").html();
      let template = Handlebars.compile(source);

      objectsListArea.append(template(data));
    }
    loaded();
  });
}

function listMoreObjects(e, bucket, prefix, nextContinuationToken) {
  $(e).parent().parent().hide();
  pageListObjects(bucket, prefix, nextContinuationToken);
}

function showPath(bucket, prefix) {
  let str = '<nobr>s3://';
  str += '<a href="javascript:;" onclick="pageListObjects(\'' + bucket + '\', \'\')">' + bucket + '</a>';
  let nextPre = '';
  $.each(prefix.split('/'), function(index, val) {
    if (val !== '') {
      nextPre += val + '/';
      str += '/<a href="javascript:;" onclick="pageListObjects(\'' + bucket + '\', \'' + nextPre + '\')">' + val + '</a>';
    }
  });
  str += '<nobr>';

  let path = $('#path');
  path.attr('bucket', bucket);
  path.attr('dir', prefix);
  path.html(str);
}

function showProperties(bucket, key, size, etag, lastModified, storageClass, url) {
  let splits = key.replace(/\/$/, '').split('\/');
  let filename = splits[splits.length - 1];

  let propertiesArea = $('#properties_list');
  let dataFileArea = propertiesArea.find('#data-file');
  dataFileArea.attr('data-key', key);
  dataFileArea.attr('data-bucket', bucket);

  let dataFile = dataFileArea.find('span');
  dataFile.eq(0).html(filename);
  dataFile.eq(1).show();

  propertiesArea.find('#data-size').html(formatFileSize(size));
  propertiesArea.find('#data-etag').html(etag);
  propertiesArea.find('#data-last-modified').html(lastModified);
  propertiesArea.find('#data-storage_class').html(storageClass);

  let urlArea = propertiesArea.find('#data-url a');
  urlArea.attr('href', url);
  urlArea.html(url);
}

function showPreSignedUrl() {
  let dataFileArea = $('#data-file');
  let bucket = dataFileArea.attr('data-bucket');
  let region = getCacheBucketLocation(bucket);
  let params = {
    Bucket: bucket,
    Key: dataFileArea.attr('data-key'),
    Expires: 300
  };

  AWS.config.region = region;
  let s3 = new AWS.S3();
  let url = s3.getSignedUrl('getObject', params);
  let urlArea = $('#data-url a');
  urlArea.attr('href', url);
  urlArea.html(url);
}

function pageDeleteObject(e) {
  let dataFileArea = $(e).parent();
  let bucket = dataFileArea.attr('data-bucket');
  let region = getCacheBucketLocation(bucket);
  let key = dataFileArea.attr('data-key');

  let confirmed = confirm('Do you want to delete this object? \n\ns3://' + bucket + '/' + key);
  if (confirmed) {
    let params = {
      Bucket: bucket,
      Key: key,
    };
    AWS.config.region = region;
    let s3 = new AWS.S3();

    loading();
    s3.deleteObject(params, function(err, data) {
      if (err) {
        loaded();
        console.error('Deleting objects error:', err);
        if (err.code === 'NetworkingError' && (err.region !== 'us-eat-1' || err.region !== 'cn-north-1')) {
          alert(CORSRule);
        } else {
          alert(err);
        }
      } else {
        pageListObjects(bucket, key.substring(0, key.replace(/\/$/, '').lastIndexOf('\/') + 1));
      }
    });
  }
}

function formatFileSize(size) {
  if (!size || size === 0) return '';
  let re = size;
  size = Number(size);
  if (size < 1024) {
    size = size.toFixed(0) + "B";
  } else if (size < 1048576) {
    size = size / 1024;
    size = size.toFixed(1) + "KB";
  } else if (size < 1073741824) {
    size = size / 1048576;
    size = size.toFixed(3) + "MB";
  } else {
    size = size / 1073741824;
    size = size.toFixed(3) + "GB";
  }
  return re + ' (' + size + ')';
}

function toggleKey() {
  $("#key").toggle(400);
  return false;
}

function about() {
  window.open('about.html', '', 'width=300, height=200, top=50, left=50');
  return false;
}

function loading() {
  NProgress.start();
}

function loaded() {
  NProgress.done();
}

function getCacheBucketLocation(bucketName) {
  return sessionStorage.getItem('BUCKETLOCATION-' + bucketName);
}

function setCacheBucketLocation(bucketName, region) {
  sessionStorage.setItem('BUCKETLOCATION-' + bucketName, region);
}

Handlebars.registerHelper('replaceDotInBucket', function(bucket) {
  return bucket.replace(/\./g, '_');
});

Handlebars.registerHelper('keyFilter', function(parentPrefix, Key) {
  return Key.replace(parentPrefix, '').replace(/\/$/, '');
});

Handlebars.registerHelper('notFolder', function(key, options) {
  if (/\/$/.test(key)) {
    return options.inverse(this);
  } else {
    return options.fn(this);
  }
});

