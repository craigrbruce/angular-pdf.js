(function (ns) {

    ns.app = angular.module('pdf', ["ngSanitize", "ngResource", "ngRoute"])
        .directive('pdfViewer', ['$timeout', function ($timeout) {

        //real world: you will probably need to dynamically generate the URL or get it from another component
        function getContentUrl() {
            return "test.pdf";
        }

        return {
            restrict: 'E',
            replace: true,
            transclude: true,
            templateUrl: 'pdfViewer.html',
            link: function ($scope) {
                $scope.item = null;
                $scope.currentPageNumber = 1;
                $scope.currentPage = null;
                $scope.totalPages = 0;
                $scope.pdf = null;
                $scope.thumbnails = [];
                $scope.allowPrint = false; // or true .. the choice is yours
                PDFJS.workerSrc = 'lib/pdf.worker.js';

                $scope.printPdf = function () {
                    var iframe =  document.getElementById('print-frame');
                    var contentFrame = iframe.contentWindow || iframe;
                    contentFrame.focus();
                    $timeout(function () {
                        if (iframe.contentDocument.execCommand('print', false, null) === false) {
                            iframe.focus();
                            contentFrame.focus();
                            window.print.apply(contentFrame, []);
                        }
                    }, 500);
                };

                $scope.scaleOptions = [
                    {name: "Actual Size", id: 1},
                    {name: "Page Width", id: "page-width"},
                    {name: "50%", id: 0.5},
                    {name: "75%", id: 0.75},
                    {name: "100%", id: 1.0},
                    {name: "125%", id: 1.25},
                    {name: "150%", id: 1.5},
                    {name: "200%", id: 2.0}
                ];

                $scope.scale = $scope.scaleOptions[0];

                $scope.$watch('scale', function (newValue, oldValue) {
                    if (newValue !== oldValue) {
                        renderPage();
                    }
                });

                $scope.onNumberChanged = function () {
                    renderPage();
                };

                $scope.nextPage = function () {
                    if ($scope.currentPageNumber < $scope.pdf.numPages) {
                        $scope.currentPageNumber++;
                        renderPage();
                    }
                };

                $scope.prevPage = function () {
                    if ($scope.currentPageNumber > 1) {
                        $scope.currentPageNumber--;
                        renderPage();
                    }
                };

                $scope.onSelectThumb = function (thumb) {
                    $scope.currentPageNumber = thumb.pageNumber;
                    renderPage();
                };

                $scope.thumbnailClass = function (thumb) {
                    if (thumb.pageNumber === $scope.currentPageNumber) {
                        return "thumbnail highlight";
                    }
                    return "thumbnail fade";
                };

                (function initialise() {
                    PDFJS.getDocument(getContentUrl())
                        .then(function (pdf) {
                            $scope.pdf = pdf;
                            $scope.totalPages = pdf.numPages;
                            renderPage();
                            ns.safeApply($scope, function(){
                                //first set up the ng-repeat
                                for (var i = 1; i < pdf.numPages + 1; i++) {
                                    $scope.thumbnails.push({pageNumber: i});
                                }
                            });

                            //then on the next $digest, render in the thumbnails and printables.
                            $timeout(function () {
                                $("#print-container").html('');
                                var frame = createIframe();
                                for (var i = 0; i < pdf.numPages + 1; i++) {
                                    //noinspection JSHint
                                    (function (pageNumber) {
                                        pdf.getPage(pageNumber)
                                            .then(function (page) {
                                                renderViewport(page, document.getElementById('thumbnail-' + pageNumber), 0.25);
                                                var printable = document.createElement('canvas');
                                                $(printable).addClass('printable-canvas');
                                                printable.id = 'printable-' + pageNumber;
                                                renderViewport(page, printable, 1);

                                                //firefox needs this prod:
                                                $timeout(function () {
                                                    $(frame.contentDocument.body).append(printable);
                                                }, 500);
                                            });
                                    })(i);
                                }
                            }, 100);
                        }, function (response) {
                           console.debug("Hwwwoops!", response)
                        });
                })();

                function createIframe() {
                    var iframe = document.getElementById('print-frame');
                    if (!iframe) {
                        iframe = document.createElement('iframe');
                        iframe.setAttribute('id', 'print-frame');
                        $(iframe).attr('style', 'margin-left: -1000px');
                        $(document.body).append(iframe);
                    }  else{
                        $(iframe.contentDocument.body).empty();
                    }
                    return iframe;
                }

                function renderPage() {
                    $scope.pdf && $scope.pdf.getPage($scope.currentPageNumber)
                        .then(function (page) {
                            $scope.currentPage = page;
                            var canvas = $("#pdf-viewer")[0];
                            renderViewport(page, canvas, getScale(page));
                        });
                }

                function clearContext(ctx, canvas) {
                    ctx.save();
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.restore();
                }

                function renderViewport(page, canvas, scale) {
                    var viewport = page.getViewport(scale);
                    var context = canvas.getContext('2d');
                    clearContext(context, canvas);
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    var renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };
                    page.render(renderContext);
                }

                function getScale(page) {
                    if ($scope.scale.id === "page-width") {
                        return $("#pdf-container").width() / page.getViewport(1.0).width;
                    }
                    return $scope.scale.id;
                }
            }
        };
    }   ]);

    ns.safeApply = function ($scope, fn) {
        if (!$scope.$$phase) {
            $scope.$apply(fn);
        } else {
            fn();
        }
    };

})(window.pdfViewer = window.pdfViewer || {});